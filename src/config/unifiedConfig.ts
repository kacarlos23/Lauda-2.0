import "dotenv/config";

const MIN_PRODUCTION_JWT_SECRET_BYTES = 32;
const MIN_PRODUCTION_SECURITY_SECRET_BYTES = 32;
const LOCAL_JWT_SECRET = "local-access-secret-for-non-production-only";
const LOCAL_REFRESH_JWT_SECRET = "local-refresh-secret-for-non-production-only";
const LOCAL_PASSWORD_RESET_PEPPER = "local-password-reset-pepper-for-non-production-only";
const LOCAL_RATE_LIMIT_HMAC_KEY = "local-rate-limit-hmac-key-for-non-production-only";

type RateLimitStore = "memory" | "redis";
type RateLimitFailureMode = "open" | "closed";
type PasswordResetDeliveryMode = "disabled" | "smtp";

function resolveJwtSecret(
  environment: NodeJS.ProcessEnv,
  variableName: "JWT_SECRET" | "REFRESH_JWT_SECRET",
  localDefault: string,
  isProduction: boolean,
): string {
  const configuredSecret = environment[variableName];
  const hasConfiguredSecret = Boolean(configuredSecret?.trim());

  if (isProduction && !hasConfiguredSecret) {
    throw new Error(`${variableName} is required in production`);
  }

  const secret = hasConfiguredSecret ? configuredSecret! : localDefault;

  if (
    isProduction &&
    Buffer.byteLength(secret, "utf8") < MIN_PRODUCTION_JWT_SECRET_BYTES
  ) {
    throw new Error(
      `${variableName} must be at least ${MIN_PRODUCTION_JWT_SECRET_BYTES} bytes in production`,
    );
  }

  return secret;
}

function resolveSecuritySecret(
  environment: NodeJS.ProcessEnv,
  variableName: "PASSWORD_RESET_PEPPER" | "RATE_LIMIT_HMAC_KEY",
  localDefault: string,
  isProduction: boolean,
): string {
  const configuredSecret = environment[variableName]?.trim();

  if (isProduction && !configuredSecret) {
    throw new Error(`${variableName} is required in production`);
  }

  const secret = configuredSecret || localDefault;
  if (isProduction && Buffer.byteLength(secret, "utf8") < MIN_PRODUCTION_SECURITY_SECRET_BYTES) {
    throw new Error(`${variableName} must be at least ${MIN_PRODUCTION_SECURITY_SECRET_BYTES} bytes in production`);
  }

  return secret;
}

function parsePositiveInteger(value: string | undefined, fallback: number, variableName: string): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${variableName} must be a positive integer`);
  }
  return parsed;
}

function parseNonNegativeInteger(value: string | undefined, fallback: number, variableName: string): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${variableName} must be a non-negative integer`);
  }
  return parsed;
}

export function createConfig(environment: NodeJS.ProcessEnv = process.env) {
  const appEnv = environment.NODE_ENV || "development";
  if (!["development", "test", "production"].includes(appEnv)) {
    throw new Error("NODE_ENV must be development, test, or production");
  }
  const isProduction = appEnv === "production";
  const jwtSecret = resolveJwtSecret(
    environment,
    "JWT_SECRET",
    LOCAL_JWT_SECRET,
    isProduction,
  );
  const refreshJwtSecret = resolveJwtSecret(
    environment,
    "REFRESH_JWT_SECRET",
    LOCAL_REFRESH_JWT_SECRET,
    isProduction,
  );
  const passwordResetPepper = resolveSecuritySecret(
    environment,
    "PASSWORD_RESET_PEPPER",
    LOCAL_PASSWORD_RESET_PEPPER,
    isProduction,
  );
  const rateLimitHmacKey = resolveSecuritySecret(
    environment,
    "RATE_LIMIT_HMAC_KEY",
    LOCAL_RATE_LIMIT_HMAC_KEY,
    isProduction,
  );

  if (isProduction && jwtSecret === refreshJwtSecret) {
    throw new Error(
      "JWT_SECRET and REFRESH_JWT_SECRET must use independent values in production",
    );
  }

  if (
    isProduction &&
    new Set([jwtSecret, refreshJwtSecret, passwordResetPepper, rateLimitHmacKey]).size !== 4
  ) {
    throw new Error("JWT, password reset, and rate limit secrets must use independent values in production");
  }


  const rateLimitStore = (environment.RATE_LIMIT_STORE || (isProduction ? "redis" : "memory")) as RateLimitStore;
  if (!(["memory", "redis"] as string[]).includes(rateLimitStore)) {
    throw new Error("RATE_LIMIT_STORE must be either memory or redis");
  }
  if (isProduction && rateLimitStore !== "redis") {
    throw new Error("RATE_LIMIT_STORE must be redis in production");
  }
  if (rateLimitStore === "redis" && !environment.RATE_LIMIT_REDIS_URL?.trim()) {
    throw new Error("RATE_LIMIT_REDIS_URL is required when RATE_LIMIT_STORE is redis");
  }

  const rateLimitFailureMode = (
    environment.RATE_LIMIT_FAILURE_MODE || (isProduction ? "closed" : "open")
  ) as RateLimitFailureMode;
  if (!(["open", "closed"] as string[]).includes(rateLimitFailureMode)) {
    throw new Error("RATE_LIMIT_FAILURE_MODE must be either open or closed");
  }
  if (isProduction && rateLimitFailureMode !== "closed") {
    throw new Error("RATE_LIMIT_FAILURE_MODE must be closed in production");
  }
  const rateLimitEnabled = environment.RATE_LIMIT_ENABLED
    ? environment.RATE_LIMIT_ENABLED === "true"
    : appEnv !== "test";
  if (isProduction && !rateLimitEnabled) {
    throw new Error("RATE_LIMIT_ENABLED must be true in production");
  }

  const passwordResetDeliveryMode = (
    environment.PASSWORD_RESET_DELIVERY_MODE || (isProduction ? "smtp" : "disabled")
  ) as PasswordResetDeliveryMode;
  if (!(["disabled", "smtp"] as string[]).includes(passwordResetDeliveryMode)) {
    throw new Error("PASSWORD_RESET_DELIVERY_MODE must be either disabled or smtp");
  }
  if (isProduction && passwordResetDeliveryMode !== "smtp") {
    throw new Error("PASSWORD_RESET_DELIVERY_MODE must be smtp in production");
  }

  const smtp = {
    host: environment.SMTP_HOST?.trim() || null,
    port: parsePositiveInteger(environment.SMTP_PORT, 587, "SMTP_PORT"),
    secure: environment.SMTP_SECURE === "true",
    user: environment.SMTP_USER?.trim() || null,
    password: environment.SMTP_PASSWORD || null,
    from: environment.SMTP_FROM?.trim() || null,
  };
  if (
    passwordResetDeliveryMode === "smtp" &&
    (!smtp.host || !smtp.user || !smtp.password || !smtp.from)
  ) {
    throw new Error("SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM are required for SMTP delivery");
  }

  const passwordResetTestPin = environment.PASSWORD_RESET_TEST_PIN?.trim() || null;
  if (passwordResetTestPin && appEnv !== "test") {
    throw new Error("PASSWORD_RESET_TEST_PIN is allowed only when NODE_ENV is test");
  }
  if (passwordResetTestPin && !/^\d{6}$/.test(passwordResetTestPin)) {
    throw new Error("PASSWORD_RESET_TEST_PIN must contain exactly 6 digits");
  }

  return {
    env: appEnv,
    port: environment.PORT ? parseInt(environment.PORT, 10) : 3000,
    auth: {
      jwtSecret,
      jwtExpiresIn: environment.JWT_EXPIRES_IN || "15m",
      refreshJwtSecret,
      refreshJwtExpiresIn: environment.REFRESH_JWT_EXPIRES_IN || "7d",
      passwordResetPepper,
      passwordResetPepperVersion: parsePositiveInteger(
        environment.PASSWORD_RESET_PEPPER_VERSION,
        1,
        "PASSWORD_RESET_PEPPER_VERSION",
      ),
      passwordResetMaxAttempts: parsePositiveInteger(
        environment.PASSWORD_RESET_MAX_ATTEMPTS,
        5,
        "PASSWORD_RESET_MAX_ATTEMPTS",
      ),
      passwordResetTestPin,
      passwordResetDelivery: {
        mode: passwordResetDeliveryMode,
        smtp,
      },
    },
    rateLimit: {
      enabled: rateLimitEnabled,
      store: rateLimitStore,
      redisUrl: environment.RATE_LIMIT_REDIS_URL?.trim() || null,
      redisConnectTimeoutMs: parsePositiveInteger(
        environment.RATE_LIMIT_REDIS_CONNECT_TIMEOUT_MS,
        3_000,
        "RATE_LIMIT_REDIS_CONNECT_TIMEOUT_MS",
      ),
      hmacKey: rateLimitHmacKey,
      failureMode: rateLimitFailureMode,
    },
    http: {
      host: environment.HOST?.trim() || "0.0.0.0",
      trustProxyHops: parseNonNegativeInteger(environment.TRUST_PROXY_HOPS, 0, "TRUST_PROXY_HOPS"),
    },
    db: {
      url: environment.DATABASE_URL,
    },
    memberInviteBaseUrl:
      environment.MEMBER_INVITE_BASE_URL || "https://laudaapp.com/convite",
  };
}

export const config = createConfig();
