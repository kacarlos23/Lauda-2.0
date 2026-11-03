const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env.public-test");
function validateConfig(env) {
  const db = new URL(env.DATABASE_URL);
  if (db.hostname !== "127.0.0.1" || db.port !== "5436" || db.pathname !== "/lauda_public_test" || decodeURIComponent(db.username) !== "lauda_test") throw new Error("Refused: public test database must be isolated on port 5436.");
  const required = { NODE_ENV: "development", DEPLOYMENT_ENVIRONMENT: "staging", PORT: "3020", HOST: "127.0.0.1", JWT_ISSUER: "lauda-public-test", PUSH_NOTIFICATIONS_ENABLED: "false", PASSWORD_RESET_DELIVERY_MODE: "disabled", REALTIME_ENABLED: "false", RATE_LIMIT_STORE: "memory" };
  for (const [key, value] of Object.entries(required)) if (env[key] !== value) throw new Error(`Refused: invalid isolated setting ${key}`);
  if (env.SMTP_HOST || env.EXPO_PUSH_ACCESS_TOKEN || env.RATE_LIMIT_REDIS_URL || env.REALTIME_REDIS_URL) throw new Error("Refused: external delivery/shared Redis must not be configured.");
  const keys = ["JWT_SECRET", "REFRESH_JWT_SECRET", "PASSWORD_RESET_PEPPER", "RATE_LIMIT_HMAC_KEY", "MFA_ENCRYPTION_KEY"];
  if (keys.some(key => !env[key] || env[key].length < 64) || new Set(keys.map(key => env[key])).size !== keys.length) throw new Error("Independent test secrets are required.");
  return env;
}
function readConfig() { return validateConfig(dotenv.parse(fs.readFileSync(envPath))); }
function childEnvironment() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(SMTP_|EXPO_PUSH_|DATABASE_URL$|JWT_|REFRESH_JWT_|RATE_LIMIT_|REALTIME_|PASSWORD_RESET_|MFA_|SECRET_|KMS_|SECRETS_PROVIDER$)/.test(key)) delete env[key];
  return { ...env, ...readConfig(), DOTENV_CONFIG_PATH: envPath };
}
module.exports = { root, envPath, readConfig, validateConfig, childEnvironment };
