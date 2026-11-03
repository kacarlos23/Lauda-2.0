const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readConfig, validateConfig } = require("./public-test-config.cjs");
test("refuses production database, shared sessions and external delivery", () => {
  const valid = readConfig();
  for (const change of [
    { DATABASE_URL: "postgresql://postgres:placeholder@127.0.0.1:5434/lauda2" },
    { DATABASE_URL: "postgresql://lauda_test:placeholder@127.0.0.1:5436/lauda2" },
    { JWT_ISSUER: "lauda-api" },
    { REFRESH_JWT_SECRET: valid.JWT_SECRET },
    { SMTP_HOST: "smtp.example.com" },
    { PUSH_NOTIFICATIONS_ENABLED: "true" },
    { PASSWORD_RESET_DELIVERY_MODE: "smtp" },
    { RATE_LIMIT_REDIS_URL: "redis://127.0.0.1:6379" },
    { REALTIME_REDIS_URL: "redis://127.0.0.1:6379" },
  ]) assert.throws(() => validateConfig({ ...valid, ...change }), JSON.stringify(Object.keys(change)));
});
