import "dotenv/config";

export const config = {
  env: process.env.NODE_ENV || "development",
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  auth: {
    jwtSecret: process.env.JWT_SECRET || "default_super_secret_for_dev_only",
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
    refreshJwtSecret:
      process.env.REFRESH_JWT_SECRET ||
      process.env.JWT_SECRET ||
      "default_refresh_super_secret_for_dev_only",
    refreshJwtExpiresIn: process.env.REFRESH_JWT_EXPIRES_IN || "7d",
  },
  db: {
    url: process.env.DATABASE_URL,
  },
  memberInviteBaseUrl:
    process.env.MEMBER_INVITE_BASE_URL || "https://laudaapp.com/convite",
};
