"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { randomBytes, createHash } = require("node:crypto");
const { setTimeout: sleep } = require("node:timers/promises");
const snapshot = require("./snapshot.cjs");
const publisher = require("../publisher/core.cjs");

const ROOT = path.resolve(__dirname, "../..");
const WORK = path.join(ROOT, "test-results", "staging-deploy");
const STAGING = publisher.environment(ROOT, "staging");
const REPO = "kacarlos23/Lauda-2.0";
const PUBLIC = "https://testes.laudaapp.com";
const RELEASE_WORKFLOW = ".github/workflows/staging-release.yml";
const STAGING_CONFIG = path.join(os.homedir(), ".codex", "worktrees",
  "public-test-environment", "Lauda 2.0", "scripts", "public-test-config.cjs");
const SECRET = path.join(WORK, "admin.dpapi");
const STATE = path.join(WORK, "state.json");
const JOURNAL = path.join(WORK, "activation.json");

function command(executable, args, options = {}) {
  const { input, onOutput, ...spawnOptions } = options;
  const child = spawn(executable, args, {
    cwd: ROOT, windowsHide: true, stdio: ["pipe", "pipe", "ignore"], ...spawnOptions,
  });
  let output = "";
  child.stdout.setEncoding("utf8").on("data", chunk => {
    if (output.length < 4_000_000) output += chunk;
    onOutput?.(output);
  });
  child.stdin.on("error", () => {});
  child.stdin.end(input);
  return once(child, "close").then(([code]) => ({ code, output: output.trim() }));
}

async function checked(executable, args, options) {
  const result = await command(executable, args, options);
  if (result.code !== 0) throw new Error("Command failed: " + path.basename(executable) + " " + args.slice(0, 1).join(" "));
  return result.output;
}

async function gitCredential() {
  const output = await checked("git.exe", ["-c", "credential.interactive=never", "credential", "fill"], {
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" },
    input: "protocol=https\nhost=github.com\n\n",
  });
  const token = output.match(/^password=(.+)$/m)?.[1]?.trim();
  if (!token) throw new Error("Git Credential Manager has no noninteractive GitHub credential");
  return token;
}

async function github(token, pathname, download = false) {
  const response = await fetch("https://api.github.com/repos/" + REPO + pathname, {
    headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(download ? 120_000 : 20_000),
  });
  if (!response.ok) throw new Error("GitHub release request returned " + response.status);
  return response;
}

async function candidateRun(token) {
  const ref = await github(token, "/git/ref/heads/staging").then(response => response.json());
  const sha = ref.object?.sha;
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error("Invalid staging Git reference");
  const data = await github(token, "/actions/runs?branch=staging&event=push&head_sha=" + sha)
    .then(response => response.json());
  const run = data.workflow_runs?.find(item => item.path === RELEASE_WORKFLOW && item.head_sha === sha
    && item.head_branch === "staging" && item.event === "push" && item.head_repository?.full_name === REPO);
  if (run?.status !== "completed" || run.conclusion !== "success") return null;
  const result = await github(token, "/actions/runs/" + run.id + "/artifacts").then(response => response.json());
  const artifact = result.artifacts?.find(item => item.name === "lauda-staging-" + sha && !item.expired);
  if (!artifact || !/^sha256:[a-f0-9]{64}$/.test(artifact.digest)
      || artifact.size_in_bytes < 1 || artifact.size_in_bytes > 200 * 1024 * 1024) {
    throw new Error("Approved release has no valid artifact");
  }
  return { sha, artifact };
}

async function downloadRelease(token, run, directory) {
  const zip = path.join(directory, "release.zip");
  const response = await github(token, "/actions/artifacts/" + run.artifact.id + "/zip", true);
  const body = Buffer.from(await response.arrayBuffer());
  if ("sha256:" + createHash("sha256").update(body).digest("hex") !== run.artifact.digest) {
    throw new Error("GitHub artifact digest does not match");
  }
  fs.writeFileSync(zip, body, { flag: "wx" });
  const entries = await checked("tar.exe", ["-tf", zip]);
  const valid = entries.split(/\r?\n/).every(entry => /^(backend|web)\//.test(entry)
    && !entry.split("/").some(piece => piece === "." || piece === ".." || /[:\\]/.test(piece)));
  if (!valid || !entries) throw new Error("Unexpected release archive paths");
  const kinds = await checked("tar.exe", ["-tvf", zip]);
  if (!kinds.split(/\r?\n/).every(line => /^[d-]/.test(line))) throw new Error("Unexpected release archive file type");
  await checked("tar.exe", ["-xf", zip, "-C", directory]);
  const web = publisher.readJson(path.join(directory, "web/release.json"));
  const backend = publisher.readJson(path.join(directory, "backend/release.json"));
  if (web.commit !== run.sha || backend.commit !== run.sha || web.backendCommit !== run.sha
      || web.environment !== "staging" || backend.environment !== "staging"
      || web.apiUrl !== STAGING.apiUrl || web.sourceHash !== backend.sourceHash
      || !/^[a-f0-9]{64}$/.test(web.sourceHash)) {
    throw new Error("Release manifests do not match the approved staging commit");
  }
  return web;
}

function safeEnv(extra = {}) {
  const config = require(STAGING_CONFIG).childEnvironment();
  return { ...config, npm_config_cache: path.join(WORK, "npm-cache"), ...extra };
}

async function adminPassword(create) {
  const powershell = ["-NoProfile", "-NonInteractive", "-Command"];
  if (fs.existsSync(SECRET)) {
    return checked("powershell.exe", [...powershell, "$s=ConvertTo-SecureString ([Console]::In.ReadToEnd()); [Console]::Write((New-Object System.Net.NetworkCredential('', $s)).Password)"], {
      input: fs.readFileSync(SECRET, "utf8"),
    });
  }
  if (!create) throw new Error("No staging password has been prepared");
  const password = randomBytes(24).toString("base64url");
  const encrypted = await checked("powershell.exe", [...powershell,
    "$s=ConvertTo-SecureString ([Console]::In.ReadToEnd()) -AsPlainText -Force; ConvertFrom-SecureString $s"], { input: password });
  if (!/^[a-f0-9]+$/i.test(encrypted)) throw new Error("Could not protect the staging password with Windows DPAPI");
  fs.writeFileSync(SECRET, encrypted, { flag: "wx" });
  return password;
}

async function prepareBackend(directory, candidate) {
  const backend = path.join(directory, "backend");
  const node = process.execPath;
  const npm = path.join(path.dirname(node), "node_modules/npm/bin/npm-cli.js");
  const prisma = path.join(backend, "node_modules/prisma/build/index.js");
  const candidateUrl = snapshot.stagingUrl(require(STAGING_CONFIG).readConfig(), candidate);
  const env = safeEnv({ DATABASE_URL: candidateUrl });
  const options = { cwd: backend, env };
  const applied = await snapshot.stageSql(candidate,
    'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;');
  for (const migration of applied.split(/\r?\n/)) {
    if (!/^[a-zA-Z0-9_-]+$/.test(migration) || !fs.existsSync(path.join(backend, "prisma/migrations", migration, "migration.sql"))) {
      throw new Error("The staging commit is missing a migration already applied in production");
    }
  }
  await checked(node, [npm, "ci", "--ignore-scripts", "--no-audit", "--no-fund"], options);
  await checked(node, [prisma, "migrate", "deploy"], options);
  await checked(node, [prisma, "migrate", "status"], options);
  await checked(node, [prisma, "generate"], options);
  await checked(node, [npm, "prune", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], options);
  const tables = await snapshot.checkSchema(sql => snapshot.stageSql(candidate, sql));
  await snapshot.verifySanitized(candidate, tables);
  return env;
}

async function waitForHealth(base, attempts) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(base + "/health", { signal: AbortSignal.timeout(4_000), cache: "no-store" });
      if (response.ok && (await response.json()).status === "ok") return;
    } catch {}
    await sleep(1000);
  }
  throw new Error("Staging API health check failed");
}

async function smoke(base, account) {
  const options = { signal: AbortSignal.timeout(15_000), cache: "no-store" };
  const login = await fetch(base + "/api/auth/login", {
    ...options, method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  if (!login.ok) throw new Error("Staging login failed with HTTP " + login.status);
  const data = (await login.json()).data;
  const token = data?.accessToken || data?.token;
  if (!token) throw new Error("No access token returned by staging");
  for (const route of ["/api/songs", "/api/schedules"]) {
    const response = await fetch(base + route, { ...options, headers: { authorization: "Bearer " + token } });
    if (!response.ok) throw new Error("Staging check failed for " + route + " with HTTP " + response.status);
    await response.json();
  }
}

async function testBackend(directory, env, account) {
  const base = "http://127.0.0.1:3021";
  const backend = path.join(directory, "backend");
  const child = spawn(process.execPath, [path.join(backend, "server.js")], {
    cwd: backend, env: { ...env, PORT: "3021" }, windowsHide: true, stdio: "ignore",
  });
  const done = once(child, "close");
  try {
    await Promise.race([waitForHealth(base, 30), done.then(() => { throw new Error("Candidate API exited"); })]);
    await smoke(base, account);
  } finally {
    child.kill();
    await done;
  }
}

async function publicManifest() {
  const response = await fetch(PUBLIC + "/release.json?verify=" + Date.now(), {
    signal: AbortSignal.timeout(10_000), cache: "no-store",
  });
  if (!response.ok || response.headers.get("x-lauda-environment") !== "staging") {
    throw new Error("Public staging gateway did not return its release");
  }
  return response.json();
}

async function smokePublic(expected, account) {
  await waitForHealth(PUBLIC, 10);
  const live = await publicManifest();
  if (live.environment !== "staging" || live.sourceHash !== expected.sourceHash) {
    throw new Error("Public staging gateway serves a different release");
  }
  const page = await fetch(PUBLIC + "/login", { signal: AbortSignal.timeout(10_000) });
  if (!page.ok || !(await page.text()).includes("/_expo/")) throw new Error("Public staging login page did not load");
  await smoke(PUBLIC, account);
}

async function publisherStatus() {
  const output = await checked(process.execPath, ["scripts/request-publication.cjs", "status"]);
  const status = JSON.parse(output.slice(output.indexOf("{")));
  if (status.status !== "completed" || status.data.services.staging.health?.status !== "ok"
      || !status.data.services.staging.processManagement) {
    throw new Error("The local publisher did not identify a healthy staging service");
  }
}

async function requestPublication(action, onRequest = () => {}) {
  let id;
  const result = await command(process.execPath, ["scripts/request-publication.cjs", action], {
    onOutput(output) {
      const next = output.match(/^Request: ([a-f0-9-]{36})/m)?.[1];
      if (next && !id) {
        id = next;
        onRequest(id);
      }
    },
  });
  if (!id) return { status: "not-queued" };
  const recorded = await command(process.execPath, ["scripts/request-publication.cjs", "--result", id]);
  if (!recorded.output.startsWith("{")) return { id, status: "pending" };
  return { ...JSON.parse(recorded.output), commandStatus: result.code };
}

function stageArtifacts(directory, id) {
  for (const [name, target] of [["web", STAGING.nextWeb], ["backend", STAGING.nextApi]]) {
    publisher.plainPath(ROOT, target, true);
    if (fs.existsSync(target)) fs.renameSync(target, target + "-pre-auto-" + id);
    fs.renameSync(path.join(directory, name), target);
  }
  return publisher.checkRelease(ROOT, STAGING);
}

async function restoreCode(previous, outcome, id) {
  if (publisher.readJson(path.join(STAGING.web, "release.json")).sourceHash === previous.sourceHash) return;
  if (outcome.status !== "completed" || !Array.isArray(outcome.data?.backups)) {
    throw new Error("Verify the publisher result and retained release directories before recovery");
  }
  const directory = path.join(WORK, "restore-" + id);
  fs.mkdirSync(directory);
  for (const [name, live] of [["web", STAGING.web], ["backend", STAGING.api]]) {
    const source = outcome.data.backups.find(file => file.startsWith(live + "-before-"));
    if (!source) throw new Error("Previous release backup was not found");
    fs.cpSync(publisher.plainPath(ROOT, source), path.join(directory, name), { recursive: true });
  }
  stageArtifacts(directory, id + "-rollback");
  const restored = await requestPublication("publish-staging");
  if (restored.status !== "completed") throw new Error("Previous code could not be republished");
}

async function deploy(run, token, prepareOnly) {
  await publisherStatus();
  const id = randomBytes(8).toString("hex");
  const directory = path.join(WORK, id);
  fs.mkdirSync(directory);
  const release = await downloadRelease(token, run, directory);
  const candidate = "lauda_stage_candidate_" + id;
  const previous = "lauda_stage_previous_" + id;
  const failed = "lauda_stage_failed_" + id;
  const { smoke: account, counts } = await snapshot.prepareSnapshot(candidate, require("bcryptjs"), await adminPassword(true));
  const env = await prepareBackend(directory, candidate);
  await testBackend(directory, env, account);
  await snapshot.stageSql(candidate, 'TRUNCATE TABLE "AuthSession" CASCADE;');
  console.log(JSON.stringify({ commit: run.sha, candidate, counts, prepared: true }));
  if (prepareOnly) return;

  const head = await github(token, "/git/ref/heads/staging").then(response => response.json());
  if (head.object?.sha !== run.sha) throw new Error("The staging branch advanced while preparing this candidate");
  await publisherStatus();
  const oldRelease = await publicManifest();
  stageArtifacts(directory, id);
  const journal = { id, commit: run.sha, candidate, previous, failed, oldRelease, phase: "switching" };
  const writeJournal = phase => { journal.phase = phase; publisher.writeJson(JOURNAL, journal); };
  writeJournal("switching");
  await snapshot.swapDatabase(candidate, previous);
  writeJournal("database-active");
  const outcome = await requestPublication("publish-staging", requestId => {
    journal.requestId = requestId;
    writeJournal("publisher-queued");
  });
  journal.outcome = outcome.status;
  writeJournal("publisher-" + outcome.status);
  if (!["completed", "failed", "not-queued"].includes(outcome.status)) {
    throw new Error("Publication outcome is unresolved. Inspect activation.json and the publisher result");
  }
  try {
    if (outcome.status !== "completed") throw new Error("Publisher did not complete the staging release");
    await smokePublic(release, account);
    await snapshot.stageSql(snapshot.LIVE, 'DELETE FROM "User" WHERE id = ' + "'" + account.userId + "';");
  } catch (error) {
    await snapshot.swapDatabase(previous, failed);
    writeJournal("database-restored");
    await restoreCode(oldRelease, outcome, id);
    const restarted = await requestPublication("restart-staging");
    if (restarted.status !== "completed" || (await publicManifest()).sourceHash !== oldRelease.sourceHash) {
      throw new Error("Previous staging release needs manual recovery");
    }
    fs.unlinkSync(JOURNAL);
    throw error;
  }
  publisher.writeJson(STATE, { commit: run.sha, status: "completed", sourceHash: release.sourceHash,
    updatedAt: new Date().toISOString(), databaseBackup: previous, counts });
  fs.unlinkSync(JOURNAL);
  console.log(JSON.stringify({ commit: run.sha, published: true, counts }));
}

async function main() {
  const option = process.argv[2];
  if (option === "--show-login") {
    console.log(snapshot.ADMIN_EMAIL + "\n" + await adminPassword(false));
    return;
  }
  if (option && option !== "--prepare-only") throw new Error("Expected --prepare-only, --show-login or no option");
  fs.mkdirSync(WORK, { recursive: true });
  if (fs.existsSync(JOURNAL)) throw new Error("An interrupted activation needs inspection before another deployment");
  const lock = path.join(WORK, "run.lock");
  const descriptor = fs.openSync(lock, "wx");
  fs.closeSync(descriptor);
  try {
    const token = await gitCredential();
    const run = await candidateRun(token);
    if (!run) return;
    const state = fs.existsSync(STATE) ? publisher.readJson(STATE) : null;
    if (state?.commit === run.sha && option !== "--prepare-only") return;
    try {
      await deploy(run, token, option === "--prepare-only");
    } catch (error) {
      if (option !== "--prepare-only") publisher.writeJson(STATE, {
        commit: run.sha, status: "failed", updatedAt: new Date().toISOString(), error: error.message,
      });
      throw error;
    }
  } finally {
    fs.unlinkSync(lock);
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
