import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/unifiedConfig";
import { Role } from "@prisma/client";
import { runWithTenantContext } from "../context/tenantContext";
import { ForbiddenError, UnauthorizedError } from "../errors/AppError";
import { isChurchAdmin } from "../utils/permissions";

interface JwtPayload {
  id?: string;
  userId?: string;
  email?: string;
  role: Role;
  tenantId: string;
}

/**
 * Validates the access token, attaches the user to Express request, and opens tenant context.
 *
 * @param req Express request containing the Authorization header.
 * @param res Express response used for authentication failures.
 * @param next Next middleware callback executed inside AsyncLocalStorage context.
 * @returns Nothing; the response is ended when authentication fails.
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next(new UnauthorizedError("Token de autenticação ausente"));
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret) as JwtPayload;
    if (!decoded.tenantId) {
      next(new UnauthorizedError("Tenant ausente no token"));
      return;
    }

    const userId = decoded.userId ?? decoded.id;
    if (!userId) {
      next(new UnauthorizedError("Usuário ausente no token"));
      return;
    }

    req.user = {
      id: userId,
      role: decoded.role,
      tenantId: decoded.tenantId,
    };

    runWithTenantContext({ userId, role: decoded.role, tenantId: decoded.tenantId }, () => next());
  } catch {
    next(new UnauthorizedError("Token inválido"));
  }
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
