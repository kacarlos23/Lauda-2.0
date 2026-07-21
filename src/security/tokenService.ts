import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { logger } from "../observability/logger";
import { config } from "../config/unifiedConfig";

export type AccessTokenPayload = jwt.JwtPayload & {
  type: "access";
  userId: string;
  sid: string;
  jti: string;
  email: string;
  role: string;
  tenantId: string | null;
};

export type RefreshTokenPayload = jwt.JwtPayload & {
  type: "refresh";
  userId: string;
  sid: string;
  jti: string;
};

type AccessIdentity = {
  id: string;
  email: string;
  role: string;
  tenantId: string | null;
};

const verificationBase = {
  algorithms: ["HS256"] as jwt.Algorithm[],
  issuer: config.auth.issuer,
};

function requireIdentityClaims(
  decoded: string | jwt.JwtPayload,
  expectedType: "access" | "refresh",
): asserts decoded is jwt.JwtPayload & { userId: string; sid: string; jti: string; sub: string; type: string } {
  if (
    typeof decoded === "string" ||
    decoded.type !== expectedType ||
    typeof decoded.userId !== "string" ||
    typeof decoded.sub !== "string" ||
    decoded.sub !== decoded.userId ||
    typeof decoded.sid !== "string" ||
    typeof decoded.jti !== "string"
  ) {
    throw new jwt.JsonWebTokenError("JWT authentication claims are invalid");
  }
}

export function signAccessToken(identity: AccessIdentity, sessionId: string): string {
  return jwt.sign(
    {
      type: "access",
      userId: identity.id,
      sid: sessionId,
      email: identity.email,
      role: identity.role,
      tenantId: identity.tenantId,
    },
    config.auth.jwtSecret,
    {
      algorithm: "HS256",
      expiresIn: config.auth.jwtExpiresIn,
      issuer: config.auth.issuer,
      audience: config.auth.accessAudience,
      subject: identity.id,
      jwtid: crypto.randomUUID(),
    } as jwt.SignOptions,
  );
}

export function signRefreshToken(userId: string, sessionId: string, jti = crypto.randomUUID()): string {
  return jwt.sign(
    { type: "refresh", userId, sid: sessionId },
    config.auth.refreshJwtSecret,
    {
      algorithm: "HS256",
      expiresIn: config.auth.refreshJwtExpiresIn,
      issuer: config.auth.issuer,
      audience: config.auth.refreshAudience,
      subject: userId,
      jwtid: jti,
    } as jwt.SignOptions,
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, config.auth.jwtSecret, {
    ...verificationBase,
    audience: config.auth.accessAudience,
  });
  requireIdentityClaims(decoded, "access");
  if (typeof decoded.email !== "string" || typeof decoded.role !== "string") {
    throw new jwt.JsonWebTokenError("JWT access claims are invalid");
  }
  return decoded as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, config.auth.refreshJwtSecret, {
    ...verificationBase,
    audience: config.auth.refreshAudience,
  });
  requireIdentityClaims(decoded, "refresh");
  return decoded as RefreshTokenPayload;
}

export function refreshTokenHash(token: string): string {
  return crypto.createHmac("sha256", config.auth.refreshJwtSecret).update(token, "utf8").digest("hex");
}

export function tokenExpiresAt(token: string): Date {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded === "string" || typeof decoded.exp !== "number") {
    throw new jwt.JsonWebTokenError("JWT expiration is missing");
  }
  return new Date(decoded.exp * 1000);
}

export function recordLegacyRefreshRejection(token: string): void {
  const decoded = jwt.decode(token);
  if (
    decoded &&
    typeof decoded !== "string" &&
    (typeof decoded.userId === "string" || typeof decoded.id === "string") &&
    (typeof decoded.sid !== "string" || typeof decoded.jti !== "string")
  ) {
    // Temporary aggregate-compatible event. Do not add token claims or client data.
    logger.warn("auth_legacy_refresh_rejected", { category: "security", outcome: "rejected" });
  }
}
