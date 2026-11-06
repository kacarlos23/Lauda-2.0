"use strict";
// Database access stays read-only; backend artifacts are optional and explicitly enabled.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFileSync, spawnSync } = require("node:child_process");
const { Pool } = require("pg");
const dotenv = require("dotenv");
const { validateDist, extractJavaScriptUrls } = require("./validate-frontend-api.cjs");
const { validateProject, validateText } = require("./validate-text-encoding.cjs");
const root = path.resolve(__dirname, "..");
const production = process.env.LAUDA_PRODUCTION_ROOT || path.join(os.homedir(), "Documents/Dev/SaaS/Lauda 2.0");
const feature = process.env.LAUDA_RELEASE_FEATURE || "visual-chord-editor";
if (!/^[a-z][a-z0-9-]*$/.test(feature)) throw new Error("Invalid release feature.");
const includeBackend = process.env.LAUDA_RELEASE_BACKEND === "1";
const evidence = path.join(root, "test-results", feature === "visual-chord-editor" ? "visual-editor-production-release" : `${feature}-production-release`);
const candidate = path.join(root, "mobile/dist");
const destination = path.join(production, "mobile/dist");
const apiUrl = "https://api.laudaapp.com/api";
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true }).trim();
const identifier = value => `"${value.replace(/"/g, '""')}"`;
function report(name, value) { fs.mkdirSync(evidence, { recursive: true }); fs.writeFileSync(path.join(evidence, name), JSON.stringify(value, null, 2) + "\n"); }
async function getJson(url) { const response = await fetch(url, { headers: { "cache-control": "no-cache" } }); if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`); return response.json(); }
async function databaseAudit() {
  const env = dotenv.parse(fs.readFileSync(path.join(production, ".env")));
  const db = new URL(env.DATABASE_URL);
  if (!["localhost", "127.0.0.1"].includes(db.hostname) || db.port !== "5434" || db.pathname !== "/lauda2") throw new Error("Unexpected production database; nothing written.");
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    const encoding = (await client.query("SHOW server_encoding")).rows[0].server_encoding;
    if (encoding !== "UTF8") throw new Error("Production database must use UTF8.");
    const columns = (await client.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND data_type IN ('text','character varying','character') ORDER BY table_name,ordinal_position")).rows;
    const tables = [...new Set(columns.map(column => column.table_name))];
    const corruptions = [];
    for (const table of tables) {
      const names = columns.filter(column => column.table_name === table).map(column => column.column_name);
      const rows = (await client.query(`SELECT ${names.map(identifier).join(",")} FROM public.${identifier(table)}`)).rows;
      for (const name of names) {
        const count = rows.filter(row => row[name] !== null && validateText(Buffer.from(row[name], "utf8"), `${table}.${name}`).length).length;
        if (count) corruptions.push({ table, column: name, rows: count });
      }
    }
    const counts = {};
    for (const table of ["Tenant", "User", "Song", "Artist", "Schedule", "Instrument", "Ministry"]) counts[table] = Number((await client.query(`SELECT count(*) count FROM ${identifier(table)}`)).rows[0].count);
    const songsDigest = (await client.query('SELECT md5(string_agg(row_to_json(s)::text, \'\' ORDER BY id)) digest FROM "Song" s')).rows[0].digest;
    let chordReview;
    if (includeBackend) {
      const { normalizeChordText } = require("../dist/utils/chordText");
      const songs = (await client.query('SELECT content FROM "Song"')).rows;
      chordReview = {
        songsChecked: songs.length,
        withInvisibleMarkers: songs.filter(song => /[\u200B\u2060\uFEFF]/.test(song.content)).length,
        normalizedForDisplay: songs.filter(song => normalizeChordText(song.content) !== song.content).length,
        storedRecordsModified: 0,
      };
    }
    await client.query("COMMIT");
    return { encoding, columnsChecked: columns.length, corruptions, counts, songsDigest, ...(chordReview ? { chordReview } : {}) };
  } finally { client.release(); await pool.end(); }
}
async function prepare() {
  const before = await getJson("https://laudaapp.com/release.json");
  const audit = await databaseAudit();
  if (audit.corruptions.length) { report("database-before.json", audit); throw new Error("Stored encoding corruption found; inspect the read-only audit."); }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = path.join(production, ".resilience", `visual-editor-${stamp}`);
  fs.mkdirSync(backup, { recursive: true });
  fs.cpSync(destination, path.join(backup, "mobile-dist-before"), { recursive: true });
  if (includeBackend) fs.cpSync(path.join(production, "dist"), path.join(backup, "backend-dist-before"), { recursive: true });
  const launcher = path.join(production, "scripts/start-project.ps1");
  fs.copyFileSync(launcher, path.join(backup, "start-project-before.ps1"));
  const dump = path.join(backup, "database-before.dump");
  const descriptor = fs.openSync(dump, "wx", 0o600);
  let result;
  try { result = spawnSync("docker", ["exec", "lauda20-postgres-1", "pg_dump", "-U", "postgres", "-d", "lauda2", "--format=custom", "--no-owner", "--no-acl"], { stdio: ["ignore", descriptor, "pipe"], encoding: "utf8", windowsHide: true }); }
  finally { fs.closeSync(descriptor); }
  if (result.status !== 0 || fs.statSync(dump).size < 1000) throw new Error("Production backup failed.");
  const value = { preparedAt: new Date().toISOString(), before, audit, backup, includeBackend, launcherBeforeHash: hash(fs.readFileSync(launcher)) };
  report("prepare.json", value); report("database-before.json", audit);
  console.log(JSON.stringify({ backup, currentCommit: before.commit, database: audit }, null, 2));
}
function publish() {
  const prepared = JSON.parse(fs.readFileSync(path.join(evidence, "prepare.json")));
  if (Boolean(prepared.includeBackend) !== includeBackend) throw new Error("Backend publication must match the prepared backup.");
  if (git(["status", "--porcelain"])) throw new Error("Commit the reviewed release before publishing.");
  const commit = git(["rev-parse", "HEAD"]);
  const remote = git(["ls-remote", "origin", "refs/heads/main"]).split(/\s+/)[0];
  if (remote !== commit) throw new Error("The reviewed commit must be on origin/main before publication.");
  const encoding = validateProject(root);
  if (encoding.errors.length) throw new Error(encoding.errors.join("\n"));
  validateDist(candidate, apiUrl);
  if (!fs.existsSync(path.join(prepared.backup, "database-before.dump"))) throw new Error("Production backup is missing.");
  if (includeBackend && (!fs.existsSync(path.join(prepared.backup, "backend-dist-before/server.js")) || !fs.existsSync(path.join(root, "dist/server.js")))) throw new Error("Backend build or backup is missing.");
  const launcher = path.join(production, "scripts/start-project.ps1");
  const nextLauncher = fs.readFileSync(path.join(root, "scripts/start-project.ps1"));
  if (![prepared.launcherBeforeHash, hash(nextLauncher)].includes(hash(fs.readFileSync(launcher)))) throw new Error("Production launcher changed since preparation; preserve local edits.");
  const expectedOldLauncher = execFileSync("git", ["show", `${prepared.before.commit}:scripts/start-project.ps1`], { cwd: root, windowsHide: true });
  // Git's blob uses LF, while the existing checkout may have CRLF.
  const normalizedHash = value => hash(value.toString("utf8").replace(/\r\n/g, "\n"));
  if (normalizedHash(fs.readFileSync(path.join(prepared.backup, "start-project-before.ps1"))) !== normalizedHash(expectedOldLauncher)) throw new Error("Production launcher has unrelated changes; do not overwrite it.");
  const html = [];
  function assets(source, target) {
    fs.mkdirSync(target, { recursive: true });
    for (const item of fs.readdirSync(source, { withFileTypes: true })) {
      const from = path.join(source, item.name), to = path.join(target, item.name);
      if (item.isDirectory()) assets(from, to);
      else if (item.name.endsWith(".html")) html.push([from, to]);
      else if (item.name !== "release.json") fs.copyFileSync(from, to);
    }
  }
  assets(candidate, destination);
  for (const [from, to] of html) { const temporary = to + ".visual-editor.tmp"; fs.copyFileSync(from, temporary); fs.renameSync(temporary, to); }
  fs.writeFileSync(launcher, nextLauncher);
  const backendCommit = includeBackend ? commit : prepared.before.backendCommit;
  if (includeBackend) {
    fs.cpSync(path.join(root, "dist"), path.join(production, "dist"), { recursive: true });
    fs.writeFileSync(path.join(production, "dist/release.json"), JSON.stringify({ commit }) + "\n");
  }
  const manifest = { commit, builtAt: new Date().toISOString(), feature, environment: "production", apiUrl, sourceFilesChecked: encoding.checked, ...(backendCommit ? { backendCommit } : {}) };
  for (const folder of [candidate, destination]) fs.writeFileSync(path.join(folder, "release.json"), JSON.stringify(manifest, null, 2) + "\n");
  report("published.json", { ...manifest, htmlFilesPublished: html.length, backup: prepared.backup });
  console.log(JSON.stringify(manifest, null, 2));
}
async function verify() {
  const published = JSON.parse(fs.readFileSync(path.join(evidence, "published.json")));
  const manifest = await getJson("https://laudaapp.com/release.json");
  if (manifest.commit !== published.commit || manifest.environment !== "production") throw new Error("The public release does not match the reviewed commit.");
  const health = await getJson("https://api.laudaapp.com/health");
  if (health.status !== "ok") throw new Error("Public production API is unhealthy.");
  if (includeBackend) {
    const backendManifest = JSON.parse(fs.readFileSync(path.join(production, "dist/release.json")));
    if (backendManifest.commit !== published.backendCommit) throw new Error("Published backend does not match the release.");
    const backendFiles = [];
    function checkBackend(directory) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const source = path.join(directory, entry.name);
        if (entry.isDirectory()) checkBackend(source);
        else {
          const relative = path.relative(path.join(root, "dist"), source);
          const sha256 = hash(fs.readFileSync(source));
          if (sha256 !== hash(fs.readFileSync(path.join(production, "dist", relative)))) throw new Error(`Backend artifact differs: ${relative}`);
          backendFiles.push({ path: relative, sha256 });
        }
      }
    }
    checkBackend(path.join(root, "dist"));
    report("backend-artifacts.json", { commit: backendManifest.commit, files: backendFiles });
  }
  const response = await fetch("https://laudaapp.com", { headers: { "cache-control": "no-cache" } });
  if (!response.ok) throw new Error("Public frontend is unhealthy.");
  const urls = extractJavaScriptUrls(await response.text(), "https://laudaapp.com");
  if (!urls.length) throw new Error("No public JavaScript bundles found.");
  const bundles = [];
  for (const url of urls) {
    const asset = await fetch(url);
    if (!asset.ok) throw new Error(`Bundle HTTP ${asset.status}`);
    const bytes = Buffer.from(await asset.arrayBuffer());
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const relative = new URL(url).pathname.replace(/^\//, "");
    if (hash(bytes) !== hash(fs.readFileSync(path.join(candidate, relative)))) throw new Error("Served bundle differs from the tested artifact.");
    bundles.push({ url, sha256: hash(bytes) });
  }
  const before = JSON.parse(fs.readFileSync(path.join(evidence, "database-before.json")));
  const after = await databaseAudit();
  report("database-after.json", after);
  if (after.corruptions.length) throw new Error("Encoding audit found invalid stored text.");
  if (after.songsDigest !== before.songsDigest || JSON.stringify(after.counts) !== JSON.stringify(before.counts)) throw new Error("Business data changed during publication; inspect audits without restoring over live edits.");
  report("verification.json", { verifiedAt: new Date().toISOString(), manifest, health, bundles, database: after, dataPreserved: true });
  console.log(JSON.stringify({ commit: manifest.commit, health, bundlesMatch: true, dataPreserved: true, encodingFindings: after.corruptions.length, columnsChecked: after.columnsChecked, counts: after.counts }, null, 2));
}
const command = process.argv[2];
Promise.resolve().then(() => command === "prepare" ? prepare() : command === "publish" ? publish() : command === "verify" ? verify() : Promise.reject(new Error("Use prepare, publish or verify."))).catch(error => { console.error(error.message); process.exitCode = 1; });
