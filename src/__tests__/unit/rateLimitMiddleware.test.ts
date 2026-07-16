import { NextFunction, Request, Response } from "express";
import { config } from "../../config/unifiedConfig";
import { createRateLimiter, pseudonymousRateLimitKey } from "../../middlewares/rateLimitMiddleware";
import type { RateLimitStore } from "../../security/rateLimitStore";

function response(): Response {
  return {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe("rate limit middleware", () => {
  const originalEnabled = config.rateLimit.enabled;
  const originalFailureMode = config.rateLimit.failureMode;

  beforeEach(() => {
    config.rateLimit.enabled = true;
    config.rateLimit.failureMode = "closed";
  });

  afterAll(() => {
    config.rateLimit.enabled = originalEnabled;
    config.rateLimit.failureMode = originalFailureMode;
  });

  it("uses pseudonymous keys without plaintext IP or e-mail", async () => {
    const keys: string[] = [];
    const store: RateLimitStore = {
      consume: jest.fn(async (key) => {
        keys.push(key);
        return { count: 1, resetAt: Date.now() + 60_000 };
      }),
    };
    const limiter = createRateLimiter({
      scope: "test-login",
      windowMs: 60_000,
      ipLimit: 10,
      identifierLimit: 5,
      identifier: (req) => req.body.email,
      store,
    });
    const req = { ip: "203.0.113.10", socket: {}, body: { email: "User@Example.com" } } as Request;
    const next = jest.fn();

    await limiter(req, response(), next as NextFunction);

    expect(next).toHaveBeenCalledWith();
    expect(keys).toHaveLength(2);
    expect(keys.join(" ")).not.toContain("203.0.113.10");
    expect(keys.join(" ")).not.toContain("user@example.com");
  });

  it.each([
    ["email", "User@Example.com"],
    ["phone", "+55 11 99999-0000"],
    ["refresh token", "eyJhbGciOiJIUzI1NiJ9.sensitive.signature"],
    ["invite code", "ABCD-1234"],
  ])("does not expose a plaintext %s in Redis keys", (_label, secret) => {
    const key = pseudonymousRateLimitKey("test", "identifier", secret.toLowerCase());
    expect(key).not.toContain(secret);
    expect(key).not.toContain(secret.toLowerCase());
  });

  it("limits a shared identifier independently across different IPs", async () => {
    const counts = new Map<string, number>();
    const store: RateLimitStore = {
      consume: jest.fn(async (key) => {
        const count = (counts.get(key) ?? 0) + 1;
        counts.set(key, count);
        return { count, resetAt: Date.now() + 60_000 };
      }),
    };
    const limiter = createRateLimiter({
      scope: "identifier-limit",
      windowMs: 60_000,
      ipLimit: 10,
      identifierLimit: 1,
      identifier: (req) => req.body.email,
      store,
    });

    const firstNext = jest.fn();
    await limiter({ ip: "203.0.113.1", socket: {}, body: { email: "same@example.com" } } as Request, response(), firstNext);
    const blockedResponse = response();
    await limiter({ ip: "203.0.113.2", socket: {}, body: { email: "same@example.com" } } as Request, blockedResponse, jest.fn());

    expect(firstNext).toHaveBeenCalledWith();
    expect(blockedResponse.status).toHaveBeenCalledWith(429);
  });

  it("limits one IP independently across different identifiers", async () => {
    const counts = new Map<string, number>();
    const store: RateLimitStore = {
      consume: jest.fn(async (key) => {
        const count = (counts.get(key) ?? 0) + 1;
        counts.set(key, count);
        return { count, resetAt: Date.now() + 60_000 };
      }),
    };
    const limiter = createRateLimiter({
      scope: "ip-limit",
      windowMs: 60_000,
      ipLimit: 1,
      identifierLimit: 10,
      identifier: (req) => req.body.email,
      store,
    });

    await limiter({ ip: "203.0.113.1", socket: {}, body: { email: "first@example.com" } } as Request, response(), jest.fn());
    const blockedResponse = response();
    await limiter({ ip: "203.0.113.1", socket: {}, body: { email: "second@example.com" } } as Request, blockedResponse, jest.fn());

    expect(blockedResponse.status).toHaveBeenCalledWith(429);
  });

  it("returns 429 and Retry-After after the configured limit", async () => {
    const store: RateLimitStore = { consume: jest.fn(async () => ({ count: 3, resetAt: Date.now() + 30_000 })) };
    const limiter = createRateLimiter({ scope: "test", windowMs: 60_000, ipLimit: 2, store });
    const res = response();
    const next = jest.fn();

    await limiter({ ip: "127.0.0.1", socket: {} } as Request, res, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String));
    expect(next).not.toHaveBeenCalled();
  });

  it("fails closed when the store is unavailable", async () => {
    const store: RateLimitStore = { consume: jest.fn(async () => { throw new Error("store unavailable"); }) };
    const limiter = createRateLimiter({ scope: "test", windowMs: 60_000, ipLimit: 2, store });
    const next = jest.fn();

    await limiter({ ip: "127.0.0.1", socket: {} } as Request, response(), next as NextFunction);

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 503 });
  });

  it("allows an explicit non-production fail-open policy", async () => {
    config.rateLimit.failureMode = "open";
    const store: RateLimitStore = { consume: jest.fn(async () => { throw new Error("store unavailable"); }) };
    const limiter = createRateLimiter({ scope: "test", windowMs: 60_000, ipLimit: 2, store });
    const next = jest.fn();

    await limiter({ ip: "127.0.0.1", socket: {} } as Request, response(), next as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });
});
