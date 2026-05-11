import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/unifiedConfig";
import { Role } from "@prisma/client";
import { runWithTenantContext } from "../context/tenantContext";

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
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: Token missing" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret) as JwtPayload;
    if (!decoded.tenantId) {
      res.status(401).json({ error: "Unauthorized: Tenant missing" });
      return;
    }

    const userId = decoded.userId ?? decoded.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized: User missing" });
      return;
    }

    req.user = {
      id: userId,
      role: decoded.role,
      tenantId: decoded.tenantId,
    };

    runWithTenantContext(
      { userId, role: decoded.role, tenantId: decoded.tenantId },
      () => next()
    );
  } catch {
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};
