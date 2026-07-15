import "dotenv/config";

const MIN_PRODUCTION_JWT_SECRET_BYTES = 32;
const LOCAL_JWT_SECRET = "local-access-secret-for-non-production-only";
const LOCAL_REFRESH_JWT_SECRET = "local-refresh-secret-for-non-production-only";

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

export function createConfig(environment: NodeJS.ProcessEnv = process.env) {
  const appEnv = environment.NODE_ENV || "development";
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

  if (isProduction && jwtSecret === refreshJwtSecret) {
    throw new Error(
      "JWT_SECRET and REFRESH_JWT_SECRET must use independent values in production",
    );
  }

  return {
    env: appEnv,
    port: environment.PORT ? parseInt(environment.PORT, 10) : 3000,
    auth: {
      jwtSecret,
      jwtExpiresIn: environment.JWT_EXPIRES_IN || "15m",
      refreshJwtSecret,
      refreshJwtExpiresIn: environment.REFRESH_JWT_EXPIRES_IN || "7d",
    },
    db: {
      url: environment.DATABASE_URL,
    },
    memberInviteBaseUrl:
      environment.MEMBER_INVITE_BASE_URL || "https://laudaapp.com/convite",
  };
}

export const config = createConfig();
