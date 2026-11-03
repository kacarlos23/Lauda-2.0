// One-time snapshot. Production is accessed only through pg_dump and SELECT.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { root, envPath, readConfig } = require("./public-test-config.cjs");
const { Pool } = require("pg");
const container = "lauda-public-test-db";
function docker(args, options = {}) {
  const result = spawnSync("docker", args, { encoding: "utf8", windowsHide: true, ...options });
  if (result.status !== 0) throw new Error(`Docker operation failed: ${result.stderr || result.error || result.status}`);
  return result.stdout;
}
async function main() {
  const existing = docker(["ps", "-a", "--filter", `name=^/${container}$`, "--format", "{{.Names}}"]);
  const resumeEmpty = process.argv.includes("--resume-empty");
  if ((existing.trim() || fs.existsSync(envPath)) && !resumeEmpty) throw new Error("Refused: test environment already initialized. Never overwrite an existing snapshot automatically.");
  if (resumeEmpty && (!existing.trim() || !fs.existsSync(envPath))) throw new Error("An existing empty isolated database is required to resume initialization.");
  const secret = () => crypto.randomBytes(48).toString("hex");
  const password = secret();
  let values = {
    NODE_ENV: "development", DEPLOYMENT_ENVIRONMENT: "staging",
    DATABASE_URL: `postgresql://lauda_test:${password}@127.0.0.1:5436/lauda_public_test`,
    POSTGRES_DB: "lauda_public_test", POSTGRES_USER: "lauda_test", POSTGRES_PASSWORD: password,
    JWT_SECRET: secret(), REFRESH_JWT_SECRET: secret(), PASSWORD_RESET_PEPPER: secret(), RATE_LIMIT_HMAC_KEY: secret(), MFA_ENCRYPTION_KEY: secret(),
    JWT_ISSUER: "lauda-public-test", HOST: "127.0.0.1", PORT: "3020", TRUST_PROXY_HOPS: "1",
    RATE_LIMIT_STORE: "memory", RATE_LIMIT_ENABLED: "true", REALTIME_ENABLED: "false",
    PUSH_NOTIFICATIONS_ENABLED: "false", PASSWORD_RESET_DELIVERY_MODE: "disabled",
    MEMBER_INVITE_BASE_URL: "https://testes.laudaapp.com/convite",
    EXPO_PUBLIC_API_URL: "https://testes.laudaapp.com/api", EXPO_PUBLIC_APP_ENV: "staging",
  };
  if (resumeEmpty) {
    values = readConfig();
    const info = JSON.parse(docker(["inspect", container]))[0];
    if (!info.Config.Env.includes("POSTGRES_DB=lauda_public_test") || info.HostConfig.PortBindings["5432/tcp"][0].HostPort !== "5436") throw new Error("Unexpected database container.");
    const check = new Pool({ connectionString: values.DATABASE_URL });
    try { if ((await check.query("SELECT count(*)::int count FROM information_schema.tables WHERE table_schema='public'")).rows[0].count !== 0) throw new Error("Refused: resume is allowed only for an empty database."); }
    finally { await check.end(); }
  } else {
    fs.writeFileSync(envPath, Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n") + "\n", { mode: 0o600, flag: "wx" });
    readConfig();
    docker(["run", "--detach", "--name", container, "--restart", "unless-stopped", "--publish", "127.0.0.1:5436:5432", "--env-file", envPath, "--mount", "type=volume,source=lauda-public-test-data,target=/var/lib/postgresql/data", "--security-opt", "no-new-privileges:true", "postgres:15"]);
  }
  let ready = false;
  for (let i = 0; i < 180; i++) {
    const result = spawnSync("docker", ["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "lauda_test", "-d", "lauda_public_test"], { windowsHide: true, stdio: "ignore" });
    if (result.status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error("Isolated database did not become ready.");
  const backups = path.join(root, ".resilience/public-test");
  fs.mkdirSync(backups, { recursive: true });
  const dump = path.join(backups, "initial-production-snapshot.dump");
  const descriptor = fs.openSync(dump, "wx", 0o600);
  try { docker(["exec", "lauda20-postgres-1", "pg_dump", "-U", "postgres", "-d", "lauda2", "--format=custom", "--no-owner", "--no-acl"], { stdio: ["ignore", descriptor, "pipe"] }); }
  finally { fs.closeSync(descriptor); }
  docker(["cp", dump, `${container}:/tmp/production-snapshot.dump`]);
  docker(["exec", container, "pg_restore", "-U", "lauda_test", "-d", "lauda_public_test", "--no-owner", "--no-acl", "--exit-on-error", "/tmp/production-snapshot.dump"]);
  const pool = new Pool({ connectionString: values.DATABASE_URL });
  try {
    await pool.query(`TRUNCATE TABLE "AuthSession", "SupportAccessGrant", "PushDevice", "DomainEventOutbox" CASCADE`);
    await pool.query(`UPDATE "User" SET "mfaSecretEncrypted"=NULL, "mfaEnabledAt"=NULL, "resetPasswordToken"=NULL, "resetPasswordChallengeId"=NULL, "resetPasswordPepperVersion"=NULL, "resetPasswordAttempts"=0, "resetPasswordConsumedAt"=NULL, "resetPasswordExpires"=NULL`);
    const counts = (await pool.query(`SELECT (SELECT count(*) FROM "Song")::int songs, (SELECT count(*) FROM "User")::int users, (SELECT count(*) FROM "Tenant")::int tenants, (SELECT count(*) FROM "Schedule")::int schedules, (SELECT count(*) FROM "Artist")::int artists`)).rows[0];
    const report = { snapshotAt: new Date().toISOString(), source: "lauda2", target: "lauda_public_test", counts, externalDeliveries: "disabled", sessions: "independent; production sessions removed", mfa: "production MFA secrets removed from clone" };
    fs.mkdirSync(path.join(root, "test-results/public-test"), { recursive: true });
    fs.writeFileSync(path.join(root, "test-results/public-test/snapshot.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
