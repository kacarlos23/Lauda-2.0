import crypto from "node:crypto";
import { NextFunction, Request, Response } from "express";
import { config } from "../config/unifiedConfig";
import { ServiceUnavailableError } from "../errors/AppError";
import { rateLimitStore, type RateLimitStore } from "../security/rateLimitStore";

type RateLimitOptions = {
  scope: string;
  windowMs: number;
  ipLimit: number;
  identifierLimit?: number;
  identifier?: (req: Request) => string | null | undefined;
  store?: RateLimitStore;
};

export function pseudonymousRateLimitKey(scope: string, kind: "ip" | "identifier", value: string): string {
  const digest = crypto
    .createHmac("sha256", config.rateLimit.hmacKey)
    .update(`${scope}:${kind}:${value}`, "utf8")
    .digest("base64url");
  return `rl:${scope}:${kind}:${digest}`;
}

function normalizedIdentifier(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

function setHeaders(res: Response, limit: number, count: number, resetAt: number): void {
  const remaining = Math.max(limit - count, 0);
  const retryAfter = Math.max(Math.ceil((resetAt - Date.now()) / 1000), 1);
  res.setHeader("RateLimit-Limit", String(limit));
  res.setHeader("RateLimit-Remaining", String(remaining));
  res.setHeader("RateLimit-Reset", String(retryAfter));
}

export function createRateLimiter(options: RateLimitOptions) {
  const store = options.store ?? rateLimitStore();

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!config.rateLimit.enabled) {
      next();
      return;
    }
    try {
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      const checks = [{
        key: pseudonymousRateLimitKey(options.scope, "ip", ip),
        limit: options.ipLimit,
      }];
      const identifier = normalizedIdentifier(options.identifier?.(req));
      if (identifier && options.identifierLimit) {
        checks.push({
          key: pseudonymousRateLimitKey(options.scope, "identifier", identifier),
          limit: options.identifierLimit,
        });
      }

      for (const check of checks) {
        const result = await store.consume(check.key, options.windowMs);
        setHeaders(res, check.limit, result.count, result.resetAt);
        if (result.count > check.limit) {
          const retryAfter = Math.max(Math.ceil((result.resetAt - Date.now()) / 1000), 1);
          res.setHeader("Retry-After", String(retryAfter));
          res.status(429).json({
            success: false,
            error: "Muitas tentativas. Tente novamente mais tarde.",
            code: "RATE_LIMITED",
          });
          return;
        }
      }

      next();
    } catch (error) {
      if (config.rateLimit.failureMode === "open") {
        next();
        return;
      }
      next(new ServiceUnavailableError("Proteção contra abuso temporariamente indisponível"));
    }
  };
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

export const loginRateLimit = createRateLimiter({
  scope: "login",
  windowMs: FIFTEEN_MINUTES,
  ipLimit: 20,
  identifierLimit: 10,
  identifier: (req) => req.body?.email,
});

export const refreshRateLimit = createRateLimiter({
  scope: "refresh",
  windowMs: FIFTEEN_MINUTES,
  ipLimit: 60,
  identifierLimit: 30,
  identifier: (req) => req.body?.refreshToken,
});

export const forgotPasswordRateLimit = createRateLimiter({
  scope: "forgot-password",
  windowMs: ONE_HOUR,
  ipLimit: 10,
  identifierLimit: 3,
  identifier: (req) => req.body?.email,
});

export const resetPasswordRateLimit = createRateLimiter({
  scope: "reset-password",
  windowMs: FIFTEEN_MINUTES,
  ipLimit: 20,
  identifierLimit: 5,
  identifier: (req) => req.body?.email,
});

export const registrationRateLimit = createRateLimiter({
  scope: "register",
  windowMs: ONE_HOUR,
  ipLimit: 5,
  identifierLimit: 3,
  identifier: (req) => req.body?.email,
});

export const memberRegistrationRateLimit = createRateLimiter({
  scope: "member-register",
  windowMs: ONE_HOUR,
  ipLimit: 10,
  identifierLimit: 10,
  identifier: (req) => req.body?.inviteCode,
});

export const inviteReadRateLimit = createRateLimiter({
  scope: "member-invite-read",
  windowMs: ONE_HOUR,
  ipLimit: 60,
  identifierLimit: 30,
  identifier: (req) => req.user?.id,
});

export const inviteRegenerateRateLimit = createRateLimiter({
  scope: "member-invite-regenerate",
  windowMs: ONE_HOUR,
  ipLimit: 20,
  identifierLimit: 10,
  identifier: (req) => req.user?.id,
});
