"use strict";

const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { pipeline } = require("node:stream/promises");
const { randomUUID, randomBytes } = require("node:crypto");

const SOURCE = "lauda20-postgres-1";
const TARGET = "lauda-public-test-db";
const LIVE = "lauda_public_test";
const ADMIN_EMAIL = "admin.staging@example.invalid";
const EPHEMERAL_TABLES = [
  "AdminAuditLog", "AuthSession", "DomainEventOutbox", "MemberInvite", "Notification",
  "PushDelivery", "PushDevice", "RefreshToken", "RefreshTokenFamily", "SupportAccessGrant",
];
const PUBLIC_TABLES = [
  "Artist", "Instrument", "Ministry", "MinistryMember", "MinistrySong", "Permission",
  "Schedule", "ScheduleAssignment", "ScheduleSong", "Song", "SongTag", "SongTagAssignment",
  "Tenant", "User", "UserInstrument", "UserPermission", "WorshipOrder", "_prisma_migrations",
];
const USER_COLUMNS = [
  "id", "email", "password", "name", "phone", "role", "tenantId", "createdAt", "updatedAt",
  "resetPasswordExpires", "resetPasswordToken", "avatarUrl", "isActive", "deletedAt",
  "resetPasswordChallengeId", "resetPasswordPepperVersion", "resetPasswordAttempts",
  "resetPasswordConsumedAt", "mfaSecretEncrypted", "mfaEnabledAt", "comments",
];

function databaseName(name) {
  if (name !== LIVE && !/^lauda_stage_(candidate|previous|failed)_[a-f0-9]{16}$/.test(name)) {
    throw new Error("Invalid staging database name");
  }
  return '"' + name + '"';
}

function docker(args, input) {
  const child = spawn("docker.exe", args, { windowsHide: true, stdio: ["pipe", "pipe", "ignore"] });
  let output = "";
  child.stdout.setEncoding("utf8").on("data", data => { output += data; });
  child.stdin.on("error", () => {});
  child.stdin.end(input);
  return once(child, "close").then(([code]) => {
    if (code !== 0) throw new Error("Docker command failed: " + args.slice(0, 2).join(" "));
    return output.trim();
  });
}

function stageSql(db, sql) {
  if (db !== "postgres") databaseName(db);
  return docker(["exec", "-i", TARGET, "psql", "-XqAt", "-v", "ON_ERROR_STOP=1", "-U", "lauda_test", "-d", db], sql);
}

function sourceSql(sql) {
  return docker(["exec", "-i", "-e", "PGOPTIONS=-c default_transaction_read_only=on", SOURCE,
    "psql", "-XqAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "lauda2"], sql);
}

function stagingUrl(config, db) {
  databaseName(db);
  const url = new URL(config.DATABASE_URL);
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.port !== "5436"
      || url.username !== "lauda_test" || url.pathname !== "/" + LIVE || url.search || url.hash) {
    throw new Error("Unexpected staging database configuration");
  }
  url.pathname = "/" + db;
  return url.toString();
}

async function verifyContainers() {
  const expected = new Map([[SOURCE, "5434"], [TARGET, "5436"]]);
  for (const [container, port] of expected) {
    const binding = await docker(["port", container, "5432/tcp"]);
    if (binding !== "127.0.0.1:" + port) throw new Error("Unexpected PostgreSQL container or port");
  }
}

async function checkSchema(query) {
  const tables = new Set((await query("SELECT tablename FROM pg_tables WHERE schemaname = 'public';")).split(/\r?\n/));
  const approved = new Set([...EPHEMERAL_TABLES, ...PUBLIC_TABLES]);
  const unknown = [...tables].filter(table => !approved.has(table));
  if (unknown.length) throw new Error("Review snapshot policy for tables: " + unknown.join(", "));
  const columns = new Set((await query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User';"
  )).split(/\r?\n/));
  if (columns.size !== USER_COLUMNS.length || USER_COLUMNS.some(column => !columns.has(column))) {
    throw new Error("Review snapshot policy for changed User columns");
  }
  return tables;
}

async function streamSnapshot(candidate, tables) {
  const exclude = EPHEMERAL_TABLES.filter(table => tables.has(table)).map(table => '--exclude-table-data=public."' + table + '"');
  const dump = spawn("docker.exe", ["exec", "-e", "PGOPTIONS=-c default_transaction_read_only=on", SOURCE,
    "pg_dump", "-U", "postgres", "-d", "lauda2", "-Fc", "--no-owner", "--no-acl", ...exclude],
  { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
  const restore = spawn("docker.exe", ["exec", "-i", TARGET, "pg_restore", "-U", "lauda_test",
    "-d", candidate, "--no-owner", "--no-acl", "--exit-on-error", "--single-transaction"],
  { windowsHide: true, stdio: ["pipe", "ignore", "ignore"] });
  try {
    const [dumpResult, restoreResult] = await Promise.all([
      once(dump, "close"), once(restore, "close"), pipeline(dump.stdout, restore.stdin),
    ]);
    if (dumpResult[0] !== 0 || restoreResult[0] !== 0) throw new Error("Snapshot stream was incomplete");
  } catch (error) {
    dump.kill();
    restore.kill();
    throw error;
  }
}

function sqlLiteral(value) {
  return "'" + value.replaceAll("'", "''") + "'";
}

async function sanitize(candidate, bcrypt, adminPassword, smokePassword) {
  const discardedPassword = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
  const adminHash = await bcrypt.hash(adminPassword, 10);
  const smokeHash = await bcrypt.hash(smokePassword, 10);
  const smokeEmail = "smoke-" + randomUUID() + "@example.invalid";
  const ids = { admin: randomUUID(), smoke: randomUUID() };
  await stageSql(candidate, [
    "BEGIN;",
    "UPDATE \"User\" SET email = 'member-' || md5(id) || '@example.invalid',",
    "name = 'Membro ' || left(md5(id), 8), password = " + sqlLiteral(discardedPassword) + ",",
    "phone = NULL, \"avatarUrl\" = NULL, comments = NULL, \"mfaSecretEncrypted\" = NULL, \"mfaEnabledAt\" = NULL,",
    "\"resetPasswordToken\" = NULL, \"resetPasswordChallengeId\" = NULL, \"resetPasswordPepperVersion\" = NULL,",
    "\"resetPasswordAttempts\" = 0, \"resetPasswordConsumedAt\" = NULL, \"resetPasswordExpires\" = NULL;",
    "UPDATE \"Tenant\" SET domain = NULL;",
    "UPDATE \"MinistryMember\" SET notes = NULL;",
    "UPDATE \"ScheduleAssignment\" SET \"declineReason\" = NULL, \"substituteResolutionNote\" = NULL;",
    "UPDATE \"_prisma_migrations\" SET logs = NULL;",
    "INSERT INTO \"User\" (id,email,password,name,role,\"updatedAt\") VALUES ("
      + [ids.admin, ADMIN_EMAIL, adminHash, "Administração de testes", "GLOBAL_ADMIN"].map(sqlLiteral).join(",") + ",now());",
    "INSERT INTO \"User\" (id,email,password,name,role,\"tenantId\",\"updatedAt\") SELECT "
      + [ids.smoke, smokeEmail, smokeHash, "Validação automática", "TENANT_ADMIN"].map(sqlLiteral).slice(0, 4).join(",")
      + ",'TENANT_ADMIN',t.id,now() FROM \"Tenant\" t WHERE t.\"isActive\" AND t.\"deletedAt\" IS NULL"
      + " AND EXISTS (SELECT 1 FROM \"Song\" s WHERE s.\"tenantId\"=t.id AND s.\"isActive\" AND s.\"deletedAt\" IS NULL)"
      + " AND EXISTS (SELECT 1 FROM \"Schedule\" s WHERE s.\"tenantId\"=t.id AND s.\"isActive\" AND s.\"deletedAt\" IS NULL)"
      + " ORDER BY t.id LIMIT 1;",
    "COMMIT;",
  ].join("\n"));
  if (await stageSql(candidate, "SELECT count(*) FROM \"User\" WHERE email = " + sqlLiteral(smokeEmail) + ";") !== "1") {
    throw new Error("No active tenant with a repertoire and schedules for the smoke check");
  }
  return { email: smokeEmail, password: smokePassword, userId: ids.smoke };
}

async function verifySanitized(candidate, tables) {
  const guards = EPHEMERAL_TABLES.filter(table => tables.has(table))
    .map(table => 'EXISTS (SELECT 1 FROM "' + table + '")');
  guards.push("EXISTS (SELECT 1 FROM \"User\" WHERE email !~ '@example[.]invalid$' OR phone IS NOT NULL"
    + " OR \"avatarUrl\" IS NOT NULL OR \"mfaSecretEncrypted\" IS NOT NULL OR \"mfaEnabledAt\" IS NOT NULL"
    + " OR \"resetPasswordToken\" IS NOT NULL OR \"resetPasswordChallengeId\" IS NOT NULL"
    + " OR \"resetPasswordExpires\" IS NOT NULL)");
  if (await stageSql(candidate, "SELECT " + guards.join(" OR ") + ";") !== "f") {
    throw new Error("Sensitive data validation failed");
  }
  return stageSql(candidate,
    'SELECT json_build_object(\'songs\', (SELECT count(*) FROM "Song"),'
    + '\'schedules\', (SELECT count(*) FROM "Schedule"), \'tenants\', (SELECT count(*) FROM "Tenant"));')
    .then(JSON.parse);
}

async function prepareSnapshot(candidate, bcrypt, adminPassword) {
  databaseName(candidate);
  if (!candidate.startsWith("lauda_stage_candidate_")) throw new Error("Expected a new candidate");
  await verifyContainers();
  const tables = await checkSchema(sourceSql);
  await stageSql("postgres", "CREATE DATABASE " + databaseName(candidate) + " TEMPLATE template0;");
  await streamSnapshot(candidate, tables);
  const smoke = await sanitize(candidate, bcrypt, adminPassword, randomBytes(24).toString("hex"));
  const counts = await verifySanitized(candidate, tables);
  return { smoke, counts };
}

async function swapDatabase(incoming, outgoing) {
  const quotedLive = databaseName(LIVE);
  const quotedIncoming = databaseName(incoming);
  const quotedOutgoing = databaseName(outgoing);
  if (incoming === LIVE || outgoing === LIVE || incoming === outgoing) throw new Error("Invalid swap");
  await verifyContainers();
  // First commit the connection gate, then drain the old pool. Both renames commit together.
  await stageSql("postgres", "ALTER DATABASE " + quotedLive + " ALLOW_CONNECTIONS false;");
  try {
    for (let attempt = 0; attempt < 10; attempt++) {
      await stageSql("postgres", "SELECT pg_terminate_backend(pid, 2000) FROM pg_stat_activity WHERE datname = '" + LIVE + "';");
      if (await stageSql("postgres", "SELECT count(*) FROM pg_stat_activity WHERE datname = '" + LIVE + "';") === "0") break;
      if (attempt === 9) throw new Error("Staging connections did not drain");
    }
    await stageSql("postgres", [
      "BEGIN;",
      "ALTER DATABASE " + quotedLive + " RENAME TO " + quotedOutgoing + ";",
      "ALTER DATABASE " + quotedIncoming + " RENAME TO " + quotedLive + ";",
      "ALTER DATABASE " + quotedLive + " ALLOW_CONNECTIONS true;",
      "COMMIT;",
    ].join("\n"));
  } catch (error) {
    await stageSql("postgres", "ALTER DATABASE " + quotedLive + " ALLOW_CONNECTIONS true;");
    throw error;
  }
}

module.exports = { LIVE, ADMIN_EMAIL, databaseName, stagingUrl, stageSql, checkSchema,
  prepareSnapshot, verifySanitized, swapDatabase };
