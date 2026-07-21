"use strict";

const { execFileSync } = require("node:child_process");
const { createCipheriv, createDecipheriv, createHash, randomBytes } = require("node:crypto");
const { mkdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const sourceDatabase = process.env.BACKUP_SOURCE_DATABASE || "lauda2";
const postgresUser = process.env.BACKUP_POSTGRES_USER || "postgres";
const rpoMinutes = positiveNumber(process.env.BACKUP_RPO_MINUTES || "1440", "BACKUP_RPO_MINUTES");
const rtoMinutes = positiveNumber(process.env.BACKUP_RTO_MINUTES || "60", "BACKUP_RTO_MINUTES");
const keepRestoreDatabase = process.env.KEEP_RESTORE_DATABASE === "true";

for (const [name, value] of [["BACKUP_SOURCE_DATABASE", sourceDatabase], ["BACKUP_POSTGRES_USER", postgresUser]]) {
  if (!/^[A-Za-z_][A-Za-z0-9_-]{0,62}$/.test(value)) throw new Error(`${name} contains an unsafe identifier`);
}

const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const restoreDatabase = `lauda_restore_${runId}`;
const containerDump = `/tmp/${restoreDatabase}.dump`;
const localDir = path.resolve(".resilience", runId);
const rawDump = path.join(localDir, "backup.dump");
const encryptedDump = path.join(localDir, "backup.dump.aes256gcm");
const decryptedDump = path.join(localDir, "restore.dump");
const evidencePath = path.resolve("docs", "security-program", "evidence", `${new Date().toISOString().slice(0, 10)}-restore-drill.json`);
mkdirSync(localDir, { recursive: true });

function positiveNumber(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} must be positive`);
  return parsed;
}

function docker(args, options = {}) {
  return execFileSync("docker", args, { cwd: path.resolve("."), encoding: options.encoding ?? "utf8", stdio: options.stdio ?? "pipe" });
}

function composeExec(...args) {
  return docker(["compose", "exec", "-T", "postgres", ...args]).trim();
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function encrypt(input, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  return Buffer.concat([Buffer.from("LAUDA-BACKUP-V1"), iv, cipher.getAuthTag(), encrypted]);
}

function decrypt(input, key) {
  const magic = input.subarray(0, 15).toString("utf8");
  if (magic !== "LAUDA-BACKUP-V1") throw new Error("Encrypted backup header is invalid");
  const iv = input.subarray(15, 27);
  const tag = input.subarray(27, 43);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(input.subarray(43)), decipher.final()]);
}

function databaseInventory(database) {
  const tableOutput = composeExec(
    "psql", "-U", postgresUser, "-d", database, "-Atc",
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );
  const tables = tableOutput ? tableOutput.split(/\r?\n/) : [];
  return Object.fromEntries(tables.map((table) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) throw new Error("Database contains an unsafe table identifier");
    const quotedTable = `"${table}"`;
    const count = composeExec("psql", "-U", postgresUser, "-d", database, "-Atc", `SELECT count(*) FROM public.${quotedTable}`);
    const digest = composeExec(
      "psql", "-U", postgresUser, "-d", database, "-Atc",
      `SELECT coalesce(md5(string_agg(row_hash, '' ORDER BY row_hash)), md5('')) FROM (SELECT md5(row_to_json(t)::text) AS row_hash FROM public.${quotedTable} t) rows`,
    );
    if (!/^\d+$/.test(count) || !/^[a-f0-9]{32}$/.test(digest)) throw new Error(`Invalid inventory result for table ${table}`);
    return [table, { rowCount: Number(count), contentMd5: digest }];
  }));
}

const drillStartedAt = new Date();
let backupCompletedAt;
let restoreStartedAt;
let restoreCompletedAt;
let encryptedHash;
let dumpBytes;
let sourceDigest;
let restoredDigest;
let encryptionKeySource;

try {
  docker(["compose", "ps", "--status", "running", "postgres"]);
  composeExec("pg_dump", "-U", postgresUser, "--format=custom", `--file=${containerDump}`, sourceDatabase);
  docker(["compose", "cp", `postgres:${containerDump}`, rawDump]);
  backupCompletedAt = new Date();

  const raw = readFileSync(rawDump);
  dumpBytes = raw.length;
  const configuredKey = process.env.BACKUP_DRILL_KEY_B64;
  const key = configuredKey ? Buffer.from(configuredKey, "base64") : randomBytes(32);
  if (key.length !== 32) throw new Error("BACKUP_DRILL_KEY_B64 must decode to exactly 32 bytes");
  encryptionKeySource = configuredKey ? "operator-supplied" : "ephemeral-in-memory";
  const encrypted = encrypt(raw, key);
  writeFileSync(encryptedDump, encrypted, { mode: 0o600 });
  encryptedHash = sha256(encrypted);
  rmSync(rawDump, { force: true });

  restoreStartedAt = new Date();
  const decrypted = decrypt(readFileSync(encryptedDump), key);
  writeFileSync(decryptedDump, decrypted, { mode: 0o600 });
  docker(["compose", "cp", decryptedDump, `postgres:${containerDump}`]);
  composeExec("dropdb", "-U", postgresUser, "--if-exists", restoreDatabase);
  composeExec("createdb", "-U", postgresUser, restoreDatabase);
  composeExec("pg_restore", "-U", postgresUser, "--exit-on-error", "--no-owner", "--no-privileges", "-d", restoreDatabase, containerDump);
  sourceDigest = sha256(JSON.stringify(databaseInventory(sourceDatabase)));
  restoredDigest = sha256(JSON.stringify(databaseInventory(restoreDatabase)));
  if (sourceDigest !== restoredDigest) throw new Error("Logical data digest differs after restore");
  restoreCompletedAt = new Date();

  const rtoSeconds = (restoreCompletedAt - restoreStartedAt) / 1000;
  const recoveryPointAgeSeconds = (restoreCompletedAt - backupCompletedAt) / 1000;
  const evidence = {
    exercise: "local-full-postgresql-backup-restore",
    environment: "local-development",
    sourceDatabase,
    restoreDatabase,
    drillStartedAt: drillStartedAt.toISOString(),
    backupCompletedAt: backupCompletedAt.toISOString(),
    restoreStartedAt: restoreStartedAt.toISOString(),
    restoreCompletedAt: restoreCompletedAt.toISOString(),
    backupBytes: dumpBytes,
    encryption: "AES-256-GCM",
    encryptionKeySource,
    encryptedArtifactSha256: encryptedHash,
    logicalSourceSha256: sourceDigest,
    logicalRestoreSha256: restoredDigest,
    logicalDigestMatched: true,
    rpoTargetMinutes: rpoMinutes,
    rtoTargetMinutes: rtoMinutes,
    measuredRecoveryPointAgeSeconds: recoveryPointAgeSeconds,
    measuredRtoSeconds: rtoSeconds,
    localRpoTargetMet: recoveryPointAgeSeconds <= rpoMinutes * 60,
    localRtoTargetMet: rtoSeconds <= rtoMinutes * 60,
    deletionReplay: {
      executed: false,
      reason: "No application deletion ledger exists yet; Stage 4 prerequisite is not implemented.",
    },
    productionClaims: false,
    notes: [
      "This proves a complete local PostgreSQL dump/decrypt/restore and logical comparison only.",
      "It does not prove cloud retention, immutability, managed KMS, segregated credentials, or production RPO/RTO.",
    ],
  };
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
} finally {
  rmSync(rawDump, { force: true });
  rmSync(decryptedDump, { force: true });
  if (encryptionKeySource === "ephemeral-in-memory") rmSync(encryptedDump, { force: true });
  try { composeExec("rm", "-f", containerDump); } catch {}
  if (!keepRestoreDatabase && /^lauda_restore_\d{14}$/.test(restoreDatabase)) {
    try { composeExec("dropdb", "-U", postgresUser, "--if-exists", restoreDatabase); } catch {}
  }
}
