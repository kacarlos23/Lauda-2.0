import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { basePrisma } from "../config/prisma";
import { runWithTenantContext } from "../context/tenantContext";
import { ForbiddenError, UnauthorizedError } from "../errors/AppError";
import { isChurchAdmin } from "../utils/permissions";
import { PermissionKey } from "../constants/permissions";
import { effectivePermissionKeys, hasPermission } from "../services/permissionService";
import { isEligibleForAuthentication } from "../security/authEligibility";
import { verifyAccessToken } from "../security/tokenService";
import { config } from "../config/unifiedConfig";

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

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    next(new UnauthorizedError("Token inválido"));
    return;
  }

  const currentSession = await basePrisma.authSession.findUnique({
    where: { id: decoded.sid },
    select: {
      id: true, userId: true, expiresAt: true, revokedAt: true, mfaVerifiedAt: true, stepUpExpiresAt: true,
      user: {
        select: {
          id: true, role: true, tenantId: true, isActive: true, deletedAt: true, mfaEnabledAt: true,
          tenant: { select: { isActive: true, deletedAt: true } },
        },
      },
    },
  });
  const currentUser = currentSession?.user;

  if (
    !currentSession ||
    currentSession.userId !== decoded.userId ||
    currentSession.revokedAt ||
    currentSession.expiresAt <= new Date() ||
    !isEligibleForAuthentication(currentUser)
  ) {
    next(new UnauthorizedError("Usuário ou tenant inativo, excluído ou não encontrado"));
    return;
  }

  // Authorization state is always sourced from the database. The JWT only
  // identifies the session, so role/tenant changes take effect immediately.
  const role = currentUser.role;
  const tenantId = currentUser.tenantId;
  const permissions = await effectivePermissionKeys({ id: currentUser.id, role, tenantId }, tenantId);

  if (
    role === Role.GLOBAL_ADMIN &&
    config.auth.mfa.globalAdminRequired &&
    (!currentUser.mfaEnabledAt || !currentSession.mfaVerifiedAt)
  ) {
    next(new ForbiddenError("MFA obrigatório para administrador global"));
    return;
  }

  req.user = {
    id: currentUser.id,
    sessionId: currentSession.id,
    role,
    tenantId: tenantId ?? "",
    permissions,
    mfaVerifiedAt: currentSession.mfaVerifiedAt,
    stepUpExpiresAt: currentSession.stepUpExpiresAt,
  };

  runWithTenantContext({ userId: currentUser.id, role, tenantId }, () => next());
};

export const requireRecentStepUp = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    next(new UnauthorizedError("Token de autenticação ausente"));
    return;
  }
  if (!config.privilegedAccess.enforceStepUp) {
    next();
    return;
  }
  if (!req.user.mfaVerifiedAt || !req.user.stepUpExpiresAt || req.user.stepUpExpiresAt <= new Date()) {
    next(new ForbiddenError("Step-up MFA recente é obrigatório para esta ação"));
    return;
  }
  next();
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
