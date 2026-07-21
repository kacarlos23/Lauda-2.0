import { createConfig } from "../../config/unifiedConfig";
import { decryptMfaSecret, encryptMfaSecret, generateMfaSecret, totpCode, verifyTotpCode } from "../../security/mfa";

describe("MFA TOTP", () => {
  it("matches the RFC 6238 SHA-1 vector truncated to six digits", () => {
    const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(totpCode(rfcSecret, 59_000)).toBe("287082");
    expect(verifyTotpCode(rfcSecret, "287082", 59_000, 0)).toBe(true);
    expect(verifyTotpCode(rfcSecret, "000000", 59_000, 0)).toBe(false);
  });

  it("encrypts MFA secrets with authenticated encryption", () => {
    const secret = generateMfaSecret();
    const encrypted = encryptMfaSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(decryptMfaSecret(encrypted)).toBe(secret);
  });

  it("makes production MFA and step-up fail closed", () => {
    expect(() => createConfig({
      NODE_ENV: "production",
      DEPLOYMENT_ENVIRONMENT: "production",
      SECRETS_PROVIDER: "aws-secrets-manager",
      SECRET_NAMESPACE: "lauda/production/api",
      KMS_KEY_ID: "alias/lauda-production",
      DATABASE_URL: "postgresql://user:password@db.example.com:5432/lauda?sslmode=verify-full",
      JWT_SECRET: "a".repeat(32),
      REFRESH_JWT_SECRET: "b".repeat(32),
      PASSWORD_RESET_PEPPER: "c".repeat(32),
      RATE_LIMIT_HMAC_KEY: "d".repeat(32),
      MFA_ENCRYPTION_KEY: "e".repeat(32),
      RATE_LIMIT_STORE: "redis",
      RATE_LIMIT_REDIS_URL: "rediss://redis.example.com:6379",
      PASSWORD_RESET_DELIVERY_MODE: "smtp",
      SMTP_HOST: "smtp.example.com",
      SMTP_USER: "user",
      SMTP_PASSWORD: "password",
      SMTP_FROM: "no-reply@example.com",
      GLOBAL_ADMIN_MFA_REQUIRED: "false",
    })).toThrow("GLOBAL_ADMIN_MFA_REQUIRED must be true in production");
  });
});
