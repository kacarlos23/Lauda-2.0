import { createConfig } from "../../config/unifiedConfig";

const VALID_ACCESS_SECRET = "a".repeat(32);
const VALID_REFRESH_SECRET = "r".repeat(32);
const PRODUCTION_SECURITY_ENV = {
  PASSWORD_RESET_PEPPER: "p".repeat(32),
  RATE_LIMIT_HMAC_KEY: "l".repeat(32),
  RATE_LIMIT_STORE: "redis",
  RATE_LIMIT_REDIS_URL: "redis://localhost:6379",
  PASSWORD_RESET_DELIVERY_MODE: "smtp",
  SMTP_HOST: "smtp.example.com",
  SMTP_USER: "smtp-user",
  SMTP_PASSWORD: "smtp-password",
  SMTP_FROM: "no-reply@example.com",
};

describe("unifiedConfig JWT secrets", () => {
  it("rejects unknown environments that could bypass production safeguards", () => {
    expect(() => createConfig({ NODE_ENV: "staging" }))
      .toThrow("NODE_ENV must be development, test, or production");
  });

  it("fails in production without JWT_SECRET", () => {
    expect(() =>
      createConfig({
        NODE_ENV: "production",
        REFRESH_JWT_SECRET: VALID_REFRESH_SECRET,
        ...PRODUCTION_SECURITY_ENV,
      }),
    ).toThrow("JWT_SECRET is required in production");
  });

  it("fails in production without REFRESH_JWT_SECRET", () => {
    expect(() =>
      createConfig({
        NODE_ENV: "production",
        JWT_SECRET: VALID_ACCESS_SECRET,
        ...PRODUCTION_SECURITY_ENV,
      }),
    ).toThrow("REFRESH_JWT_SECRET is required in production");
  });

  it("initializes in production with independent valid secrets", () => {
    const productionConfig = createConfig({
      NODE_ENV: "production",
      JWT_SECRET: VALID_ACCESS_SECRET,
      REFRESH_JWT_SECRET: VALID_REFRESH_SECRET,
      ...PRODUCTION_SECURITY_ENV,
    });

    expect(productionConfig.auth.jwtSecret).toBe(VALID_ACCESS_SECRET);
    expect(productionConfig.auth.refreshJwtSecret).toBe(VALID_REFRESH_SECRET);
  });

  it("rejects equal access and refresh secrets in production", () => {
    expect(() =>
      createConfig({
        NODE_ENV: "production",
          JWT_SECRET: VALID_ACCESS_SECRET,
          REFRESH_JWT_SECRET: VALID_ACCESS_SECRET,
          ...PRODUCTION_SECURITY_ENV,
      }),
    ).toThrow(
      "JWT_SECRET and REFRESH_JWT_SECRET must use independent values in production",
    );
  });

  it.each(["JWT_SECRET", "REFRESH_JWT_SECRET"] as const)(
    "rejects a production %s shorter than 32 bytes",
    (variableName) => {
      expect(() =>
        createConfig({
          NODE_ENV: "production",
          JWT_SECRET: VALID_ACCESS_SECRET,
          REFRESH_JWT_SECRET: VALID_REFRESH_SECRET,
          ...PRODUCTION_SECURITY_ENV,
          [variableName]: "short-secret",
        }),
      ).toThrow(`${variableName} must be at least 32 bytes in production`);
    },
  );

  it.each(["development", "test"])(
    "initializes in %s with distinct local defaults",
    (nodeEnv) => {
      const localConfig = createConfig({ NODE_ENV: nodeEnv });

      expect(localConfig.auth.jwtSecret).toBeTruthy();
      expect(localConfig.auth.refreshJwtSecret).toBeTruthy();
      expect(localConfig.auth.refreshJwtSecret).not.toBe(
        localConfig.auth.jwtSecret,
      );
    },
  );

  it("does not reuse JWT_SECRET as the local refresh secret", () => {
    const developmentConfig = createConfig({
      NODE_ENV: "development",
      JWT_SECRET: "custom-local-access-secret",
    });

    expect(developmentConfig.auth.jwtSecret).toBe(
      "custom-local-access-secret",
    );
    expect(developmentConfig.auth.refreshJwtSecret).not.toBe(
      developmentConfig.auth.jwtSecret,
    );
  });

  it("requires independent password reset and rate limit secrets in production", () => {
    expect(() => createConfig({
      NODE_ENV: "production",
      JWT_SECRET: VALID_ACCESS_SECRET,
      REFRESH_JWT_SECRET: VALID_REFRESH_SECRET,
      ...PRODUCTION_SECURITY_ENV,
      PASSWORD_RESET_PEPPER: VALID_ACCESS_SECRET,
    })).toThrow("JWT, password reset, and rate limit secrets must use independent values in production");
  });

  it("requires Redis-backed rate limiting in production", () => {
    expect(() => createConfig({
      NODE_ENV: "production",
      JWT_SECRET: VALID_ACCESS_SECRET,
      REFRESH_JWT_SECRET: VALID_REFRESH_SECRET,
      ...PRODUCTION_SECURITY_ENV,
      RATE_LIMIT_STORE: "memory",
    })).toThrow("RATE_LIMIT_STORE must be redis in production");
  });

  it("requires fail-closed rate limiting in production", () => {
    expect(() => createConfig({
      NODE_ENV: "production",
      JWT_SECRET: VALID_ACCESS_SECRET,
      REFRESH_JWT_SECRET: VALID_REFRESH_SECRET,
      ...PRODUCTION_SECURITY_ENV,
      RATE_LIMIT_FAILURE_MODE: "open",
    })).toThrow("RATE_LIMIT_FAILURE_MODE must be closed in production");
  });

  it("validates the Redis connection timeout", () => {
    expect(() => createConfig({
      NODE_ENV: "development",
      RATE_LIMIT_REDIS_CONNECT_TIMEOUT_MS: "0",
    })).toThrow("RATE_LIMIT_REDIS_CONNECT_TIMEOUT_MS must be a positive integer");
  });

  it("parses the configured reverse-proxy hop count", () => {
    const http = createConfig({
      NODE_ENV: "development",
      HOST: "127.0.0.1",
      TRUST_PROXY_HOPS: "1",
    }).http;
    expect(http).toEqual({ host: "127.0.0.1", trustProxyHops: 1 });
    expect(() => createConfig({ NODE_ENV: "development", TRUST_PROXY_HOPS: "-1" }))
      .toThrow("TRUST_PROXY_HOPS must be a non-negative integer");
  });

  it("allows deterministic reset PIN only in test", () => {
    expect(createConfig({ NODE_ENV: "test", PASSWORD_RESET_TEST_PIN: "123456" }).auth.passwordResetTestPin)
      .toBe("123456");
    expect(() => createConfig({ NODE_ENV: "development", PASSWORD_RESET_TEST_PIN: "123456" }))
      .toThrow("PASSWORD_RESET_TEST_PIN is allowed only when NODE_ENV is test");
  });
});
