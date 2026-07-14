import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/unifiedConfig";
import { Role } from "@prisma/client";
import { basePrisma } from "../config/prisma";
import { runWithTenantContext } from "../context/tenantContext";
import { ForbiddenError, UnauthorizedError } from "../errors/AppError";
import { isChurchAdmin } from "../utils/permissions";
import { PermissionKey } from "../constants/permissions";
import { effectivePermissionKeys, hasPermission } from "../services/permissionService";

interface JwtPayload {
  id?: string;
  userId?: string;
  email?: string;
  role: Role;
  tenantId?: string | null;
}

/**
 * Validates the access token, attaches the user to Express request, and opens tenant context.
 *
 * @param req Express request containing the Authorization header.
 * @param res Express response used for authentication failures.
 * @param next Next middleware callback executed inside AsyncLocalStorage context.
 * @returns Nothing; the response is ended when authentication fails.
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next(new UnauthorizedError("Token de autenticação ausente"));
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret) as JwtPayload;
    const userId = decoded.userId ?? decoded.id;
    if (!userId) {
      next(new UnauthorizedError("Usuário ausente no token"));
      return;
    }

    const currentUser = await basePrisma.user.findUnique({
      where: { id: userId },
      select: { role: true, tenantId: true, isActive: true },
    });

    if (!currentUser?.isActive) {
      next(new UnauthorizedError("Usuário inativo ou não encontrado"));
      return;
    }

    // Authorization state is always sourced from the database. The JWT only
    // identifies the session, so role/tenant changes take effect immediately.
    const role = currentUser.role;
    const tenantId = currentUser.tenantId;

    if (!tenantId && role !== Role.GLOBAL_ADMIN) {
      next(new UnauthorizedError("Tenant ausente no token"));
      return;
    }

    const permissions = await effectivePermissionKeys({ id: userId, role, tenantId }, tenantId);

    req.user = {
      id: userId,
      role,
      tenantId: tenantId ?? "",
      permissions,
    };

    runWithTenantContext({ userId, role, tenantId }, () => next());
  } catch {
    next(new UnauthorizedError("Token inválido"));
  }
};

export const requirePermission =
  (permissionKey: PermissionKey, resolveTenantId?: (req: Request) => string | null | undefined) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next(new UnauthorizedError("Token de autenticação ausente"));
      return;
    }

    try {
      const tenantId = resolveTenantId ? resolveTenantId(req) : req.user.tenantId || null;
      if (!await hasPermission(req.user, permissionKey, tenantId)) {
        next(new ForbiddenError("Usuário sem permissão para esta ação"));
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };

export const requireSelfOrPermission = (permissionKey: PermissionKey, paramName = "id") =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.user?.id === String(req.params[paramName])) {
      next();
      return;
    }
    await requirePermission(permissionKey)(req, res, next);
  };

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError("Token de autenticação ausente"));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError("Perfil sem permissão para esta rota"));
      return;
    }

    next();
  };

export const requireChurchAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    next(new UnauthorizedError("Token de autenticação ausente"));
    return;
  }

  if (!isChurchAdmin(req.user)) {
    next(new ForbiddenError("Apenas administradores da igreja podem gerenciar vínculos"));
    return;
  }

  next();
};
