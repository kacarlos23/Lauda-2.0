import "dotenv/config";

const MIN_PRODUCTION_JWT_SECRET_BYTES = 32;
const MIN_PRODUCTION_SECURITY_SECRET_BYTES = 32;
const LOCAL_JWT_SECRET = "local-access-secret-for-non-production-only";
const LOCAL_REFRESH_JWT_SECRET = "local-refresh-secret-for-non-production-only";
const LOCAL_PASSWORD_RESET_PEPPER = "local-password-reset-pepper-for-non-production-only";
const LOCAL_RATE_LIMIT_HMAC_KEY = "local-rate-limit-hmac-key-for-non-production-only";
const LOCAL_MFA_ENCRYPTION_KEY = "local-mfa-encryption-key-for-non-production-only";

type RateLimitStore = "memory" | "redis";
type RateLimitFailureMode = "open" | "closed";
type PasswordResetDeliveryMode = "disabled" | "smtp";
type SecretsProvider = "local" | "aws-secrets-manager" | "gcp-secret-manager" | "azure-key-vault";

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
  variableName: "PASSWORD_RESET_PEPPER" | "RATE_LIMIT_HMAC_KEY" | "MFA_ENCRYPTION_KEY",
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
  const deploymentEnvironment = environment.DEPLOYMENT_ENVIRONMENT?.trim() || appEnv;
  const secretsProvider = (environment.SECRETS_PROVIDER?.trim() || "local") as SecretsProvider;
  if (!("local,aws-secrets-manager,gcp-secret-manager,azure-key-vault".split(",") as string[]).includes(secretsProvider)) {
    throw new Error("SECRETS_PROVIDER must be local, aws-secrets-manager, gcp-secret-manager, or azure-key-vault");
  }
  if (isProduction && deploymentEnvironment !== "production") {
    throw new Error("DEPLOYMENT_ENVIRONMENT must be production when NODE_ENV is production");
  }
  if (isProduction && secretsProvider === "local") {
    throw new Error("Production secrets must be injected by a managed secrets provider");
  }
  const secretNamespace = environment.SECRET_NAMESPACE?.trim() || null;
  const kmsKeyId = environment.KMS_KEY_ID?.trim() || null;
  if (isProduction && (!secretNamespace || !/(^|[\/_-])production([\/_-]|$)/i.test(secretNamespace))) {
    throw new Error("SECRET_NAMESPACE must identify an isolated production namespace");
  }
  if (isProduction && !kmsKeyId) {
    throw new Error("KMS_KEY_ID is required in production");
  }
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
  const mfaEncryptionKey = resolveSecuritySecret(
    environment,
    "MFA_ENCRYPTION_KEY",
    LOCAL_MFA_ENCRYPTION_KEY,
    isProduction,
  );

  if (isProduction && jwtSecret === refreshJwtSecret) {
    throw new Error(
      "JWT_SECRET and REFRESH_JWT_SECRET must use independent values in production",
    );
  }

  if (
    isProduction &&
    new Set([jwtSecret, refreshJwtSecret, passwordResetPepper, rateLimitHmacKey, mfaEncryptionKey]).size !== 5
  ) {
    throw new Error("JWT, password reset, rate limit, and MFA secrets must use independent values in production");
  }

  const requireGlobalAdminMfa = environment.GLOBAL_ADMIN_MFA_REQUIRED
    ? environment.GLOBAL_ADMIN_MFA_REQUIRED === "true"
    : isProduction;
  if (isProduction && !requireGlobalAdminMfa) {
    throw new Error("GLOBAL_ADMIN_MFA_REQUIRED must be true in production");
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
  if (isProduction && !environment.RATE_LIMIT_REDIS_URL!.startsWith("rediss://")) {
    throw new Error("RATE_LIMIT_REDIS_URL must use rediss:// in production");
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

  const realtimeEnabled = environment.REALTIME_ENABLED
    ? environment.REALTIME_ENABLED === "true"
    : true;
  const realtimeRedisUrl = environment.REALTIME_REDIS_URL?.trim()
    || environment.RATE_LIMIT_REDIS_URL?.trim()
    || null;
  if (isProduction && realtimeEnabled && !realtimeRedisUrl) {
    throw new Error("REALTIME_REDIS_URL or RATE_LIMIT_REDIS_URL is required when realtime is enabled in production");
  }
  if (isProduction && realtimeRedisUrl && !realtimeRedisUrl.startsWith("rediss://")) {
    throw new Error("Realtime Redis must use rediss:// in production");
  }

  const pushEnabled = environment.PUSH_NOTIFICATIONS_ENABLED === "true";
  const expoAccessToken = environment.EXPO_PUSH_ACCESS_TOKEN?.trim() || null;
  if (isProduction && pushEnabled && !expoAccessToken) {
    throw new Error("EXPO_PUSH_ACCESS_TOKEN is required when push notifications are enabled in production");
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

  const databaseUrl = environment.DATABASE_URL?.trim();
  if (isProduction && !databaseUrl) {
    throw new Error("DATABASE_URL is required in production");
  }
  if (isProduction) {
    const parsedDatabaseUrl = new URL(databaseUrl!);
    const sslMode = parsedDatabaseUrl.searchParams.get("sslmode");
    if (!['require', 'verify-ca', 'verify-full'].includes(sslMode || "")) {
      throw new Error("DATABASE_URL must enforce TLS with sslmode=require, verify-ca, or verify-full in production");
    }
  }

  return {
    env: appEnv,
    deployment: {
      environment: deploymentEnvironment,
      secretsProvider,
      secretNamespace,
      kmsKeyId,
      secretRotationDays: parsePositiveInteger(environment.SECRET_ROTATION_DAYS, 90, "SECRET_ROTATION_DAYS"),
    },
    port: environment.PORT ? parseInt(environment.PORT, 10) : 3000,
    auth: {
      jwtSecret,
      jwtExpiresIn: environment.JWT_EXPIRES_IN || "15m",
      refreshJwtSecret,
      refreshJwtExpiresIn: environment.REFRESH_JWT_EXPIRES_IN || "7d",
      issuer: environment.JWT_ISSUER?.trim() || "lauda-api",
      accessAudience: environment.JWT_ACCESS_AUDIENCE?.trim() || "lauda-clients",
      refreshAudience: environment.JWT_REFRESH_AUDIENCE?.trim() || "lauda-refresh",
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
      mfa: {
        encryptionKey: mfaEncryptionKey,
        globalAdminRequired: requireGlobalAdminMfa,
        stepUpTtlMinutes: parsePositiveInteger(
          environment.ADMIN_STEP_UP_TTL_MINUTES,
          10,
          "ADMIN_STEP_UP_TTL_MINUTES",
        ),
      },
    },
    privilegedAccess: {
      enforceStepUp: environment.ADMIN_STEP_UP_REQUIRED
        ? environment.ADMIN_STEP_UP_REQUIRED === "true"
        : isProduction,
      supportMaxMinutes: parsePositiveInteger(
        environment.SUPPORT_ACCESS_MAX_MINUTES,
        60,
        "SUPPORT_ACCESS_MAX_MINUTES",
      ),
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
    realtime: {
      enabled: realtimeEnabled,
      redisUrl: realtimeRedisUrl,
      ticketTtlSeconds: parsePositiveInteger(environment.REALTIME_TICKET_TTL_SECONDS, 30, "REALTIME_TICKET_TTL_SECONDS"),
      outboxPollMs: parsePositiveInteger(environment.OUTBOX_POLL_MS, 1000, "OUTBOX_POLL_MS"),
    },
    notifications: {
      retentionDays: parsePositiveInteger(environment.NOTIFICATION_RETENTION_DAYS, 90, "NOTIFICATION_RETENTION_DAYS"),
      pushEnabled,
      expoAccessToken,
    },
    http: {
      host: environment.HOST?.trim() || "0.0.0.0",
      trustProxyHops: parseNonNegativeInteger(environment.TRUST_PROXY_HOPS, 0, "TRUST_PROXY_HOPS"),
    },
    db: {
      url: databaseUrl,
    },
    memberInviteBaseUrl:
      environment.MEMBER_INVITE_BASE_URL || "https://laudaapp.com/convite",
  };
}

export const config = createConfig();
