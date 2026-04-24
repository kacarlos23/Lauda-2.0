import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/unifiedConfig";
import { Role } from "@prisma/client";

interface JwtPayload {
  id: string;
  role: Role;
  tenantId: string;
}

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
    
    // Inject user info into the request
    req.user = {
      id: decoded.id,
      role: decoded.role,
      tenantId: decoded.tenantId,
    };
    
    next();
  } catch (error) {
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};
