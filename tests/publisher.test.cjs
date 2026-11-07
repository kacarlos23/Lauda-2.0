"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { execFileSync, spawn } = require("node:child_process");
const http = require("node:http");
const core = require("../scripts/publisher/core.cjs");
const { processNext, recoverInterrupted } = require("../scripts/publisher/worker.cjs");
const { main: requestPublication } = require("../scripts/request-publication.cjs");

function installerScript(script) {
  const helper = path.resolve(__dirname, "../scripts/publisher/install-common.ps1").replace(/'/g, "''");
  return execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `$ErrorActionPreference='Stop'; . '${helper}'\n${script}`], { encoding: "utf8", timeout: 15000, stdio: "pipe" }).trim();
}

function cleanup(directory) {
  const resolved = path.resolve(directory);
  const parent = path.resolve(os.tmpdir());
  if (path.dirname(resolved) !== parent || !/^lauda-publisher-(?:test|external)-/.test(path.basename(resolved))) throw new Error("Unsafe test cleanup path");
  fs.rmSync(resolved, { recursive: true, force: true });
}
function fixture(t, name = "staging") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lauda-publisher-test-"));
  t.after(() => cleanup(root));
  for (const folder of ["inbox", "processing", "results"]) fs.mkdirSync(path.join(root, ".lauda-publisher", folder), { recursive: true });
  const env = core.environment(root, name);
  for (const folder of [env.web, env.api, env.nextWeb, env.nextApi]) fs.mkdirSync(folder, { recursive: true });
  const release = { environment: name, apiUrl: env.apiUrl, sourceHash: "a".repeat(64), commit: "b".repeat(40), backendCommit: "b".repeat(40) };
  for (const folder of [env.nextWeb, env.nextApi]) fs.writeFileSync(path.join(folder, "release.json"), JSON.stringify(release));
  fs.writeFileSync(path.join(env.nextWeb, "index.html"), "new web");
  fs.writeFileSync(path.join(env.nextApi, "server.js"), "new api");
  fs.writeFileSync(path.join(env.web, "index.html"), "old web");
  fs.writeFileSync(path.join(env.api, "server.js"), "old api");
  const calls = [];
  const runtime = Object.fromEntries(["validate", "inspect", "restart", "verify", "status"].map(key => [key, async () => { calls.push(key); return "ok"; }]));
  return { root, env, release, runtime, calls };
}
function enqueue(root, action = "publish-staging", override = {}) {
  const request = { id: randomUUID(), action, createdAt: new Date().toISOString(), ...override };
  const file = `${request.id}.json`;
  core.writeJson(path.join(root, ".lauda-publisher/inbox", file), request);
  return { request, file, result: path.join(root, ".lauda-publisher/results", file) };
}

test("accepts only a fresh fixed action and matching UUID filename", () => {
  const request = { id: randomUUID(), action: "status", createdAt: new Date().toISOString() };
  assert.equal(core.validateRequest(request, `${request.id}.json`), request);
  for (const change of [{ action: "powershell -Command evil" }, { command: "whoami" }, { createdAt: "invalid" }, { createdAt: new Date(Date.now() - 700_000).toISOString() }, { createdAt: new Date(Date.now() + 60_000).toISOString() }]) {
    assert.throws(() => core.validateRequest({ ...request, ...change }, `${request.id}.json`));
  }
  assert.throws(() => core.validateRequest(request, `${randomUUID()}.json`));
});

test("staging and production map to separate ports and artifacts", t => {
  const { root, env } = fixture(t);
  const prod = core.environment(root, "production");
  assert.notEqual(env.api, prod.api);
  assert.notEqual(env.web, prod.web);
  assert.notEqual(env.health, prod.health);
  assert.throws(() => core.environment(root, "../production"));
  assert.throws(() => core.plainPath(root, path.resolve(root, "..", "outside"), true));
});

test("publishes both artifacts, validates before mutation and preserves backups", async t => {
  const { root, env, runtime, calls } = fixture(t);
  const productionMarker = path.join(root, "dist", "keep.txt");
  fs.mkdirSync(path.dirname(productionMarker), { recursive: true });
  fs.writeFileSync(productionMarker, "production unchanged");
  runtime.inspect = async () => { calls.push("inspect"); assert.equal(fs.readFileSync(path.join(env.web, "index.html"), "utf8"), "old web"); };
  const result = await core.publish(root, env, runtime);
  assert.deepEqual(calls, ["validate", "inspect", "restart", "verify"]);
  assert.equal(fs.readFileSync(path.join(env.web, "index.html"), "utf8"), "new web");
  assert.equal(fs.readFileSync(path.join(env.api, "server.js"), "utf8"), "new api");
  assert.equal(fs.readFileSync(path.join(result.backups[0], "server.js"), "utf8"), "old api");
  assert.equal(fs.readFileSync(path.join(result.backups[1], "index.html"), "utf8"), "old web");
  assert.equal(fs.readFileSync(productionMarker, "utf8"), "production unchanged");
});

test("bundle validation failure leaves the active release untouched", async t => {
  const { root, env, runtime } = fixture(t);
  runtime.validate = async () => { throw new Error("wrong API bundle"); };
  await assert.rejects(core.publish(root, env, runtime), /wrong API bundle/);
  assert.equal(fs.readFileSync(path.join(env.api, "server.js"), "utf8"), "old api");
});

test("an unknown process prevents swapping or restarting", async t => {
  const { root, env, runtime, calls } = fixture(t);
  runtime.inspect = async () => { throw new Error("unknown API process"); };
  await assert.rejects(core.publish(root, env, runtime), /unknown API process/);
  assert.deepEqual(calls, ["validate"]);
  assert.equal(fs.readFileSync(path.join(env.web, "index.html"), "utf8"), "old web");
});

test("health/release failure rolls back BOTH artifacts and restarts previous API", async t => {
  const { root, env, runtime, calls } = fixture(t);
  runtime.verify = async () => { calls.push("verify"); throw new Error("wrong served hash"); };
  await assert.rejects(core.publish(root, env, runtime), /wrong served hash; rollback completed/);
  assert.deepEqual(calls, ["validate", "inspect", "restart", "verify", "restart"]);
  assert.equal(fs.readFileSync(path.join(env.web, "index.html"), "utf8"), "old web");
  assert.equal(fs.readFileSync(path.join(env.api, "server.js"), "utf8"), "old api");
  assert.equal(fs.readFileSync(path.join(env.nextApi, "server.js"), "utf8"), "new api");
});

test("failure halfway through directory swap restores already moved API", async t => {
  const { root, env, runtime } = fixture(t);
  fs.rmSync(core.plainPath(root, env.web), { recursive: true });
  await assert.rejects(core.publish(root, env, runtime), /rollback completed/);
  assert.equal(fs.readFileSync(path.join(env.api, "server.js"), "utf8"), "old api");
});

test("production releases web locks before activation and resumes before API verification", async t => {
  const { root, env, runtime, calls } = fixture(t, "production");
  let paused = false;
  const rename = fs.renameSync;
  t.mock.method(fs, "renameSync", (from, to) => {
    if (from === env.web && !paused) throw Object.assign(new Error("Web file held open"), { code: "EPERM" });
    return rename(from, to);
  });
  runtime.pauseWeb = async () => { paused = true; calls.push("pauseWeb"); };
  runtime.resumeWeb = async () => {
    assert.equal(fs.readFileSync(path.join(env.web, "index.html"), "utf8"), "new web");
    paused = false;
    calls.push("resumeWeb");
  };
  await core.publish(root, env, runtime);
  assert.deepEqual(calls, ["validate", "inspect", "pauseWeb", "resumeWeb", "restart", "verify"]);
});

test("production rollback pauses the resumed web server and restores it after failure", async t => {
  const { root, env, runtime, calls } = fixture(t, "production");
  runtime.pauseWeb = async () => { calls.push("pauseWeb"); };
  runtime.resumeWeb = async () => { calls.push("resumeWeb"); };
  runtime.verify = async () => { throw new Error("Verification failed"); };
  await assert.rejects(core.publish(root, env, runtime), /Verification failed; rollback completed/);
  assert.equal(fs.readFileSync(path.join(env.web, "index.html"), "utf8"), "old web");
  assert.deepEqual(calls, ["validate", "inspect", "pauseWeb", "resumeWeb", "restart", "pauseWeb", "resumeWeb", "restart"]);
});

test("a rejected production web identity leaves both releases intact", async t => {
  const { root, env, runtime } = fixture(t, "production");
  runtime.pauseWeb = async () => { throw new Error("Unknown web process"); };
  runtime.resumeWeb = async () => {};
  await assert.rejects(core.publish(root, env, runtime), /Unknown web process; rollback completed/);
  assert.equal(fs.readFileSync(path.join(env.web, "index.html"), "utf8"), "old web");
  assert.equal(fs.readFileSync(path.join(env.api, "server.js"), "utf8"), "old api");
});

function denyWebRename(t, env, onRename = () => {}) {
  const original = fs.renameSync;
  t.mock.method(fs, "renameSync", (from, to) => {
    if (from === env.web) throw Object.assign(new Error("Windows web directory is open"), { code: "EPERM" });
    onRename(from, to);
    return original(from, to);
  });
}

test("an open web directory uses a complete backup and activates assets before HTML and manifest", async t => {
  const { root, env, runtime } = fixture(t, "production");
  fs.writeFileSync(path.join(env.web, "old-bundle.js"), "cached old asset");
  fs.writeFileSync(path.join(env.nextWeb, "new-bundle.js"), "new asset");
  const order = [];
  denyWebRename(t, env, (_, to) => { if (path.dirname(to) === env.web) order.push(path.basename(to)); });
  const result = await core.publish(root, env, runtime);
  assert.equal(result.webActivation, "files");
  assert.deepEqual(order, ["new-bundle.js", "index.html", "release.json"]);
  assert.equal(fs.readFileSync(path.join(result.backups[1], "index.html"), "utf8"), "old web");
  assert.equal(fs.readFileSync(path.join(env.web, "old-bundle.js"), "utf8"), "cached old asset");
  assert.equal(fs.readFileSync(path.join(env.web, "new-bundle.js"), "utf8"), "new asset");
  assert.equal(core.readJson(path.join(env.web, "release.json")).sourceHash, result.sourceHash);
});

test("file activation verification failure restores old files and API and removes new entrypoints", async t => {
  const { root, env, runtime } = fixture(t, "production");
  fs.writeFileSync(path.join(env.nextWeb, "new-bundle.js"), "new asset");
  fs.writeFileSync(path.join(env.nextWeb, "new-route.html"), "new route");
  denyWebRename(t, env);
  runtime.verify = async () => { throw new Error("public release mismatch"); };
  await assert.rejects(core.publish(root, env, runtime), /public release mismatch; rollback completed/);
  assert.equal(fs.readFileSync(path.join(env.web, "index.html"), "utf8"), "old web");
  assert.equal(fs.readFileSync(path.join(env.api, "server.js"), "utf8"), "old api");
  for (const name of ["new-bundle.js", "new-route.html", "release.json"]) assert.equal(fs.existsSync(path.join(env.web, name)), false);
});

test("failure partway through web file activation restores already replaced HTML", async t => {
  const { root, env, runtime } = fixture(t, "production");
  fs.writeFileSync(path.join(env.nextWeb, "new-bundle.js"), "new asset");
  fs.writeFileSync(path.join(env.nextWeb, "login.html"), "new login");
  let injected = false;
  denyWebRename(t, env, (_, to) => {
    if (!injected && to === path.join(env.web, "login.html")) { injected = true; throw new Error("web file locked"); }
  });
  await assert.rejects(core.publish(root, env, runtime), /web file locked; rollback completed/);
  assert.equal(injected, true);
  assert.equal(fs.readFileSync(path.join(env.web, "index.html"), "utf8"), "old web");
  assert.equal(fs.readFileSync(path.join(env.api, "server.js"), "utf8"), "old api");
  assert.equal(fs.existsSync(path.join(env.web, "new-bundle.js")), false);
  assert.equal(fs.readdirSync(env.web).some(name => name.endsWith(".publish.tmp")), false);
});

test("web file fallback refuses reparse points in the active tree", async t => {
  const { root, env, runtime } = fixture(t, "production");
  const external = fs.mkdtempSync(path.join(os.tmpdir(), "lauda-publisher-external-"));
  t.after(() => cleanup(external));
  fs.symlinkSync(external, path.join(env.web, "redirect"), process.platform === "win32" ? "junction" : "dir");
  denyWebRename(t, env);
  await assert.rejects(core.publish(root, env, runtime), /Reparse points.*rollback completed/);
  assert.equal(fs.readFileSync(path.join(env.api, "server.js"), "utf8"), "old api");
});

test("failed web backup leaves the frontend untouched and restores the API", async t => {
  const { root, env, runtime } = fixture(t, "production");
  denyWebRename(t, env);
  t.mock.method(fs, "cpSync", () => { throw new Error("backup copy failed"); });
  await assert.rejects(core.publish(root, env, runtime), /backup copy failed; rollback completed/);
  assert.equal(fs.readFileSync(path.join(env.web, "index.html"), "utf8"), "old web");
  assert.equal(fs.readFileSync(path.join(env.api, "server.js"), "utf8"), "old api");
});

test("file fallback never masks an API directory permission error", async t => {
  const { root, env, runtime } = fixture(t, "production");
  const original = fs.renameSync;
  t.mock.method(fs, "renameSync", (from, to) => {
    if (from === env.api) throw Object.assign(new Error("API rename denied"), { code: "EPERM" });
    return original(from, to);
  });
  await assert.rejects(core.publish(root, env, runtime), /API rename denied; rollback completed/);
  assert.equal(fs.readFileSync(path.join(env.api, "server.js"), "utf8"), "old api");
  assert.equal(fs.readFileSync(path.join(env.web, "index.html"), "utf8"), "old web");
});

test("Windows process holding its working directory reproduces EPERM and publishes through files", { skip: process.platform !== "win32" }, async t => {
  const { root, env, runtime } = fixture(t, "production");
  const script = "[Console]::WriteLine('LOCKED'); Start-Sleep -Seconds 30";
  const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { cwd: env.web, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  const exited = new Promise(resolve => child.once("exit", resolve));
  try {
    await new Promise((resolve, reject) => {
    let text = "";
    const timer = setTimeout(() => reject(new Error("Directory lock helper timeout")), 10000);
    child.stdout.on("data", bytes => { text += bytes; if (text.includes("LOCKED")) { clearTimeout(timer); resolve(); } });
    child.once("exit", code => { clearTimeout(timer); if (!text.includes("LOCKED")) reject(new Error(`Directory lock helper exited ${code}`)); });
    child.once("error", reject);
    });
    assert.throws(() => fs.renameSync(env.web, `${env.web}-locked-check`), error => ["EPERM", "EACCES", "EBUSY"].includes(error.code));
    const result = await core.publish(root, env, runtime);
    assert.equal(result.webActivation, "files");
    assert.equal(fs.readFileSync(path.join(env.web, "index.html"), "utf8"), "new web");
    assert.equal(fs.readFileSync(path.join(result.backups[1], "index.html"), "utf8"), "old web");
  } finally { child.kill(); await exited; }
});

test("Windows open HTML handle is released before production activation", { skip: process.platform !== "win32" }, async t => {
  const { root, env, runtime } = fixture(t, "production");
  const index = path.join(env.web, "index.html");
  const native = 'using System; using System.Runtime.InteropServices; public static class LaudaHtmlLock { [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] public static extern IntPtr CreateFile(string path,uint access,uint share,IntPtr security,uint mode,uint flags,IntPtr template); }';
  const script = `$ErrorActionPreference='Stop'; Add-Type -TypeDefinition '${native}'; $handle=[LaudaHtmlLock]::CreateFile('${index.replace(/'/g, "''")}',[uint32]2147483648,3,[IntPtr]::Zero,3,128,[IntPtr]::Zero); if($handle -eq [IntPtr]::new(-1)){throw 'Cannot open test HTML'}; [Console]::WriteLine('LOCKED'); Start-Sleep -Seconds 30`;
  const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  const exited = new Promise(resolve => child.once("exit", resolve));
  try {
    await new Promise((resolve, reject) => {
      let output = "";
      const timer = setTimeout(() => reject(new Error("HTML lock helper timed out")), 10000);
      child.stdout.on("data", bytes => { output += bytes; if (output.includes("LOCKED")) { clearTimeout(timer); resolve(); } });
      child.once("exit", code => { clearTimeout(timer); if (!output.includes("LOCKED")) reject(new Error(`HTML lock helper exited ${code}`)); });
      child.once("error", reject);
    });
    const probe = path.join(root, "replacement.html");
    fs.writeFileSync(probe, "replacement");
    assert.throws(() => fs.renameSync(probe, index), error => ["EPERM", "EACCES", "EBUSY"].includes(error.code));
    runtime.pauseWeb = async () => { child.kill(); await exited; };
    runtime.resumeWeb = async () => { assert.equal(fs.readFileSync(index, "utf8"), "new web"); };
    await core.publish(root, env, runtime);
    assert.equal(fs.readFileSync(index, "utf8"), "new web");
  } finally { child.kill(); await exited; }
});

test("rollback restart failure is explicitly reported", async t => {
  const { root, env, runtime } = fixture(t);
  runtime.restart = async () => { throw new Error("access denied"); };
  await assert.rejects(core.publish(root, env, runtime), /rollback requires attention: access denied/);
  assert.equal(fs.readFileSync(path.join(env.api, "server.js"), "utf8"), "old api");
});

test("candidate manifests reject crossed environment, API, hash and production commit", t => {
  for (const [name, field, value] of [["staging", "environment", "production"], ["staging", "apiUrl", "https://api.laudaapp.com/api"], ["staging", "sourceHash", "c".repeat(64)], ["production", "commit", "c".repeat(40)], ["production", "backendCommit", "c".repeat(40)]]) {
    const { root, env, release } = fixture(t, name);
    fs.writeFileSync(path.join(env.nextWeb, "release.json"), JSON.stringify({ ...release, [field]: value }));
    assert.throws(() => core.checkRelease(root, env));
  }
});

test("junctions cannot redirect release publication outside the project", t => {
  const { root, env } = fixture(t);
  const external = fs.mkdtempSync(path.join(os.tmpdir(), "lauda-publisher-external-"));
  t.after(() => cleanup(external));
  fs.symlinkSync(external, path.join(env.nextApi, "redirect"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => core.checkRelease(root, env), /Reparse points/);
});

test("queue executes once and preserves result for duplicate request ID", async t => {
  const { root, runtime, calls } = fixture(t);
  const job = enqueue(root, "status");
  assert.equal(await processNext(root, runtime), true);
  assert.equal(core.readJson(job.result).status, "completed");
  enqueue(root, "status", job.request);
  assert.equal(await processNext(root, runtime), false);
  assert.deepEqual(calls, ["status"]);
});

test("malformed, expired and oversized requests never run an action", async t => {
  const { root, runtime, calls } = fixture(t);
  for (const change of [{ action: "shell" }, { script: "bad" }, { createdAt: new Date(0).toISOString() }, { padding: "x".repeat(3000) }]) {
    const job = enqueue(root, "publish-production", change);
    await processNext(root, runtime);
    assert.equal(core.readJson(job.result).status, "failed");
  }
  assert.deepEqual(calls, []);
});

test("restart action targets only requested environment without artifact publication", async t => {
  const { root, env, runtime } = fixture(t);
  let target;
  runtime.restart = async value => { target = value; };
  const job = enqueue(root, "restart-staging");
  await processNext(root, runtime);
  assert.equal(target.name, "staging");
  assert.equal(core.readJson(job.result).status, "completed");
  assert.equal(fs.readFileSync(path.join(env.web, "index.html"), "utf8"), "old web");
});

test("a worker interruption is reported without replay, preserving completed results", t => {
  const { root } = fixture(t);
  const one = enqueue(root, "publish-production");
  const two = enqueue(root, "status");
  for (const job of [one, two]) fs.renameSync(path.join(root, ".lauda-publisher/inbox", job.file), path.join(root, ".lauda-publisher/processing", job.file));
  core.writeJson(two.result, { status: "completed", data: "original" });
  recoverInterrupted(root);
  assert.equal(core.readJson(one.result).status, "interrupted");
  assert.equal(core.readJson(two.result).data, "original");
  assert.deepEqual(fs.readdirSync(path.join(root, ".lauda-publisher/inbox")), []);
  assert.deepEqual(fs.readdirSync(path.join(root, ".lauda-publisher/processing")), []);
});

test("installation scripts parse in Windows PowerShell 5.1", { skip: process.platform !== "win32" }, () => {
  for (const file of ["scripts/install-publisher.ps1", "scripts/update-publisher.ps1", "scripts/publisher/processes.ps1", "scripts/publisher/install-common.ps1", "scripts/publisher/launch.ps1", "scripts/repair-staging-runtime.ps1", "scripts/start-staging-standard.ps1", "scripts/publisher/staging-runtime-common.ps1"]) {
    const full = path.resolve(__dirname, "..", file).replace(/'/g, "''");
    execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `$tokens=$null; $errors=$null; [System.Management.Automation.Language.Parser]::ParseFile('${full}',[ref]$tokens,[ref]$errors) > $null; if ($errors.Count) { $errors | Out-String | Write-Error; exit 1 }`]);
  }
});

test("publisher maintenance refuses pending and processing requests", { skip: process.platform !== "win32" }, t => {
  const { root } = fixture(t);
  const queue = path.join(root, ".lauda-publisher");
  const inspect = () => installerScript(`try { Assert-PublisherQueueIdle -Queue '${queue.replace(/'/g, "''")}'; 'idle' } catch { 'refused' }`);
  assert.equal(inspect(), "idle");
  for (const folder of ["inbox", "processing"]) {
    const file = path.join(queue, folder, `${randomUUID()}.json`);
    fs.writeFileSync(file, "{}");
    assert.equal(inspect(), "refused");
    fs.unlinkSync(file);
  }
  assert.equal(inspect(), "idle");
});

test("installed file and directory DACLs grant only administrator/system full access and owner read/execute", { skip: process.platform !== "win32" }, () => {
  const descriptors = JSON.parse(installerScript(`
    @($true, $false) | ForEach-Object {
      $acl = New-PublisherInstalledAcl -OwnerSid 'S-1-5-21-1-2-3-1001' -Directory:$_
      [pscustomobject]@{
        directory = $_; protected = $acl.AreAccessRulesProtected
        owner = $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value
        rules = @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]) | ForEach-Object {
          [pscustomobject]@{ sid = $_.IdentityReference.Value; rights = [int]$_.FileSystemRights; inheritance = [int]$_.InheritanceFlags; propagation = [int]$_.PropagationFlags; type = [string]$_.AccessControlType; inherited = $_.IsInherited }
        })
      }
    } | ConvertTo-Json -Depth 5 -Compress
  `));
  for (const acl of descriptors) {
    assert.equal(acl.protected, true);
    assert.equal(acl.owner, "S-1-5-32-544");
    assert.deepEqual(acl.rules.map(rule => rule.sid).sort(), ["S-1-5-18", "S-1-5-21-1-2-3-1001", "S-1-5-32-544"].sort());
    for (const rule of acl.rules) {
      assert.equal(rule.inheritance, acl.directory ? 3 : 0);
      assert.equal(rule.propagation, 0);
      assert.equal(rule.type, "Allow");
      assert.equal(rule.inherited, false);
      assert.equal(rule.rights, rule.sid === "S-1-5-21-1-2-3-1001" ? 1179817 : 2032127);
    }
  }
});

test("installed ACLs reject service and administrator group identities as worker owner", { skip: process.platform !== "win32" }, () => {
  for (const sid of ["S-1-5-18", "S-1-5-32-544"]) {
    assert.throws(() => installerScript(`New-PublisherInstalledAcl -OwnerSid '${sid}'`), /Windows user account/);
  }
});

test("repair restores config access using fresh DACLs without reading the broken ACL", { skip: process.platform !== "win32" }, t => {
  const { root } = fixture(t);
  const installed = path.join(root, "Publisher files");
  fs.mkdirSync(installed);
  const names = ["core.cjs", "worker.cjs", "processes.ps1", "launch.ps1", "config.json"];
  for (const name of names) core.writeJson(path.join(installed, name), { projectRoot: root });
  const result = JSON.parse(installerScript(`
    $installed = '${installed.replace(/'/g, "''")}'
    $script:aclCalls = @()
    $script:configReadable = $false
    function Get-Acl { throw 'The old DACL cannot be read.' }
    function Set-Acl {
      [CmdletBinding()] param($LiteralPath, $AclObject)
      $script:aclCalls += [pscustomobject]@{ path = $LiteralPath; protected = $AclObject.AreAccessRulesProtected }
      if ([IO.Path]::GetFileName($LiteralPath) -eq 'config.json') { $script:configReadable = $true }
    }
    function Get-Content {
      param($LiteralPath, [switch]$Raw)
      if (-not $script:configReadable) { throw [UnauthorizedAccessException]::new('Access to installed config.json is denied.') }
      Microsoft.PowerShell.Management\\Get-Content -LiteralPath $LiteralPath -Raw
    }
    $denied = $false
    try { $null = Get-Content -LiteralPath (Join-Path $installed 'config.json') -Raw } catch [UnauthorizedAccessException] { $denied = $true }
    Set-PublisherInstalledPermissions -Installed $installed -OwnerSid 'S-1-5-21-1-2-3-1001'
    $config = Get-Content -LiteralPath (Join-Path $installed 'config.json') -Raw | ConvertFrom-Json
    @{ deniedBeforeRepair = $denied; project = $config.projectRoot; calls = $script:aclCalls } | ConvertTo-Json -Depth 5 -Compress
  `));
  assert.equal(result.deniedBeforeRepair, true);
  assert.equal(result.project, root);
  assert.deepEqual(result.calls.map(call => call.path), [installed, ...names.map(name => path.join(installed, name))]);
  assert.ok(result.calls.every(call => call.protected));
});

test("installed permission recovery never changes files behind a junction", { skip: process.platform !== "win32" }, t => {
  const { root } = fixture(t);
  const installed = path.join(root, "Publisher");
  const external = fs.mkdtempSync(path.join(os.tmpdir(), "lauda-publisher-external-"));
  t.after(() => cleanup(external));
  fs.mkdirSync(installed);
  fs.writeFileSync(path.join(external, "config.json"), "untouched");
  fs.symlinkSync(external, path.join(installed, "redirect"), "junction");
  const result = JSON.parse(installerScript(`
    $script:aclCalls = @()
    function Set-Acl {
      [CmdletBinding()] param($LiteralPath, $AclObject)
      $script:aclCalls += $LiteralPath
    }
    $failure = $null
    try { Set-PublisherInstalledPermissions -Installed '${installed.replace(/'/g, "''")}' -OwnerSid 'S-1-5-21-1-2-3-1001' } catch { $failure = $_.Exception.Message }
    @{ failure = $failure; calls = @($script:aclCalls) } | ConvertTo-Json -Compress
  `));
  assert.match(result.failure, /Reparse point refused/);
  assert.deepEqual(result.calls, [installed]);
  assert.equal(fs.readFileSync(path.join(external, "config.json"), "utf8"), "untouched");
});

test("repair accepts both known task actions and refuses another account, project or command", { skip: process.platform !== "win32" }, t => {
  const { root } = fixture(t);
  const result = JSON.parse(installerScript(`
    $project = '${root.replace(/'/g, "''")}'
    $installed = Join-Path $project 'Publisher'
    $node = 'C:\\Program Files\\nodejs\\node.exe'
    $ps = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
    $owner = 'S-1-5-21-1-2-3-1001'
    $oldArguments = '"' + (Join-Path $installed 'worker.cjs') + '" "' + (Join-Path $installed 'config.json') + '"'
    $newArguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $installed 'launch.ps1') + '" -ConfigPath "' + (Join-Path $installed 'config.json') + '"'
    $cases = @(
      @{ User = $owner; Executable = $node; Arguments = $oldArguments; Directory = $project },
      @{ User = $owner; Executable = $ps; Arguments = $newArguments; Directory = $project },
      @{ User = 'S-1-5-21-1-2-3-1002'; Executable = $ps; Arguments = $newArguments; Directory = $project },
      @{ User = $owner; Executable = $ps; Arguments = $newArguments; Directory = (Join-Path $project 'different') },
      @{ User = $owner; Executable = $ps; Arguments = ($newArguments + ' -Unexpected'); Directory = $project },
      @{ User = $owner; Executable = 'cmd.exe'; Arguments = $newArguments; Directory = $project }
    )
    @($cases | ForEach-Object {
      $task = [pscustomobject]@{ Principal = [pscustomobject]@{ UserId = $_.User }; Actions = @([pscustomobject]@{ Execute = $_.Executable; Arguments = $_.Arguments; WorkingDirectory = $_.Directory }) }
      try { Assert-PublisherRepairTask -Task $task -OwnerSid $owner -Project $project -Installed $installed -Node $node -PowerShell $ps; $true } catch { $false }
    }) | ConvertTo-Json -Compress
  `));
  assert.deepEqual(result, [true, true, false, false, false, false]);
});

test("missing and stale heartbeat never enqueue a request and explain recovery", async t => {
  const { root } = fixture(t);
  await assert.rejects(requestPublication(["publish-staging"], root), /No request was queued.*-Repair/);
  core.writeJson(path.join(root, ".lauda-publisher/state.json"), { heartbeat: new Date(0).toISOString() });
  await assert.rejects(requestPublication(["publish-staging"], root), /heartbeat is stale/);
  assert.deepEqual(fs.readdirSync(path.join(root, ".lauda-publisher/inbox")), []);
});

test("one-time staging handover recognizes current and legacy pairs and refuses unrelated processes", { skip: process.platform !== "win32" }, t => {
  const { root } = fixture(t);
  const helper = path.resolve(__dirname, "../scripts/publisher/staging-runtime-common.ps1").replace(/'/g, "''");
  const result = JSON.parse(installerScript(`
    . '${helper}'
    $project = '${root.replace(/'/g, "''")}'
    $legacy = Join-Path $project 'legacy'
    $owner = 'S-1-5-21-1-2-3-1001'
    $goodGateway = '"C:\\Program Files\\nodejs\\node.exe" "' + (Join-Path $project 'scripts\\serve-transfer-staging.cjs') + '"'
    $goodApi = '"C:\\Program Files\\nodejs\\node.exe" "' + (Join-Path $project 'test-results\\transfer-release\\backend\\server.js') + '"'
    $cases = @(
      @{ Gateway = $goodGateway; Api = $goodApi; Owner = $owner; Parent = 42; Name = 'node.exe' },
      @{ Gateway = 'node scripts/serve-transfer-staging.cjs'; Api = 'node test-results/transfer-release/backend/server.js'; Owner = $owner; Parent = 42; Name = 'node.exe' },
      @{ Gateway = 'node "' + (Join-Path $legacy 'scripts\\public-test-server.cjs') + '"'; Api = 'node "' + (Join-Path $legacy 'dist\\server.js') + '"'; Owner = $owner; Parent = 42; Name = 'node.exe' },
      @{ Gateway = $goodGateway; Api = 'node scripts/start-production.cjs'; Owner = $owner; Parent = 42; Name = 'node.exe' },
      @{ Gateway = $goodGateway; Api = $goodApi; Owner = 'S-1-5-21-1-2-3-1002'; Parent = 42; Name = 'node.exe' },
      @{ Gateway = $goodGateway; Api = $goodApi; Owner = $owner; Parent = 99; Name = 'node.exe' },
      @{ Gateway = $goodGateway; Api = $null; Owner = $owner; Parent = 42; Name = 'node.exe' },
      @{ Gateway = 'node scripts/other-gateway.cjs'; Api = $goodApi; Owner = $owner; Parent = 42; Name = 'node.exe' },
      @{ Gateway = $goodGateway; Api = $goodApi; Owner = $owner; Parent = 42; Name = 'cmd.exe' }
    )
    @($cases | ForEach-Object {
      $gateway = [pscustomobject]@{ ProcessId = 42; Name = 'node.exe'; CommandLine = $_.Gateway; OwnerSid = $owner }
      $api = [pscustomobject]@{ ProcessId = 43; ParentProcessId = $_.Parent; Name = $_.Name; CommandLine = $_.Api; OwnerSid = $_.Owner }
      try { Assert-StagingRuntimePair -Gateway $gateway -Api $api -OwnerSid $owner -Project $project -LegacyProject $legacy; $true } catch { $false }
    }) | ConvertTo-Json -Compress
  `));
  assert.deepEqual(result, [true, true, true, false, false, false, false, false, false]);
});

test("staging task reuse requires the same standard owner, action and project", { skip: process.platform !== "win32" }, t => {
  const { root } = fixture(t);
  const helper = path.resolve(__dirname, "../scripts/publisher/staging-runtime-common.ps1").replace(/'/g, "''");
  const result = JSON.parse(installerScript(`
    . '${helper}'
    $project = '${root.replace(/'/g, "''")}'
    $owner = 'S-1-5-21-1-2-3-1001'
    $cases = @(
      @{ Owner = $owner; Level = 'Limited'; Command = 'known'; Project = $project },
      @{ Owner = 'S-1-5-21-1-2-3-1002'; Level = 'Limited'; Command = 'known'; Project = $project },
      @{ Owner = $owner; Level = 'Highest'; Command = 'known'; Project = $project },
      @{ Owner = $owner; Level = 'Limited'; Command = 'unknown'; Project = $project },
      @{ Owner = $owner; Level = 'Limited'; Command = 'known'; Project = (Join-Path $project 'other') }
    )
    @($cases | ForEach-Object {
      $task = [pscustomobject]@{ Principal = [pscustomobject]@{ UserId = $_.Owner; RunLevel = $_.Level }; Actions = @([pscustomobject]@{ Execute = 'powershell.exe'; Arguments = $_.Command; WorkingDirectory = $_.Project }) }
      try { Assert-StagingRuntimeTask -Task $task -OwnerSid $owner -Project $project -PowerShell 'powershell.exe' -Arguments 'known'; $true } catch { $false }
    }) | ConvertTo-Json -Compress
  `));
  assert.deepEqual(result, [true, false, false, false, false]);
});

test("process inspection accepts expected Node paths with spaces without stopping any process", { skip: process.platform !== "win32" }, t => {
  const { root } = fixture(t);
  const processScript = path.resolve(__dirname, "../scripts/publisher/processes.ps1").replace(/'/g, "''");
  for (const [environment, port, entry] of [["staging", 3020, "test-results/transfer-release/backend/server.js"], ["production", 3000, "scripts/start-production.cjs"]]) {
    const command = `"C:\\Program Files\\nodejs\\node.exe" "${path.join(root, entry)}"`.replace(/'/g, "''");
    const result = installerScript(`
      function netstat { '  TCP    127.0.0.1:${port}    0.0.0.0:0    LISTENING    12345' }
      function Get-CimInstance { [pscustomobject]@{ Name='node.exe'; CommandLine='${command}'; ProcessId=12345 } }
      function Invoke-CimMethod { [pscustomobject]@{ ReturnValue=0; Sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value } }
      function Stop-Process { throw 'Inspection must never stop a process.' }
      & '${processScript}' -Operation Inspect -Environment '${environment}' -ProjectRoot '${root.replace(/'/g, "''")}'
    `);
    assert.match(result, new RegExp(`Recognized ${environment} API`));
  }
});

test("launcher captures Node errors that happen before the first heartbeat", { skip: process.platform !== "win32" }, t => {
  const { root } = fixture(t);
  fs.rmdirSync(core.plainPath(root, path.join(root, ".lauda-publisher/inbox")));
  const config = path.join(root, "config.json");
  core.writeJson(config, { projectRoot: root, node: process.execPath, powershell: "powershell.exe" });
  assert.throws(() => execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", path.resolve(__dirname, "../scripts/publisher/launch.ps1"), "-ConfigPath", config], { encoding: "utf8", timeout: 15000, stdio: "pipe" }));
  assert.match(fs.readFileSync(path.join(root, ".lauda-publisher/launcher.log"), "utf8"), /Worker PID/);
  assert.match(fs.readFileSync(path.join(root, ".lauda-publisher/worker.stderr.log"), "utf8"), /Missing path/);
  assert.equal(fs.existsSync(path.join(root, ".lauda-publisher/state.json")), false);
});

test("startup diagnostics preserve scheduler result, logon type and startup errors", { skip: process.platform !== "win32" }, t => {
  const { root } = fixture(t);
  const queue = path.join(root, ".lauda-publisher");
  fs.writeFileSync(path.join(queue, "worker.stderr.log"), "startup error captured");
  const helper = path.resolve(__dirname, "../scripts/publisher/install-common.ps1").replace(/'/g, "''");
  const quotedQueue = queue.replace(/'/g, "''");
  execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `
    . '${helper}'
    function Get-ScheduledTask { [pscustomobject]@{ State='Ready'; Principal=[pscustomobject]@{UserId='test-user';LogonType='S4U';RunLevel='Limited'}; Actions=@() } }
    function Get-ScheduledTaskInfo { [pscustomobject]@{ LastTaskResult=2147943785; LastRunTime=[datetime]::UtcNow } }
    Write-PublisherDiagnostics -TaskName 'MockTask' -Queue '${quotedQueue}' -Phase 'startup-failed' -Failure 'Access to installed config.json is denied.'
  `], { stdio: "pipe" });
  const report = core.readJson(path.join(queue, "installation-startup-failed.json"));
  assert.equal(report.lastTaskResultHex, "0x80070569");
  assert.equal(report.logonType, "S4U");
  assert.equal(report.failure, "Access to installed config.json is denied.");
  assert.deepEqual(report["worker.stderr.log"], ["startup error captured"]);
});

test("production publication accepts a matching commit pair", async t => {
  const { root, env, runtime } = fixture(t, "production");
  const result = await core.publish(root, env, runtime);
  assert.equal(result.environment, "production");
  assert.equal(core.readJson(path.join(env.web, "release.json")).backendCommit, "b".repeat(40));
});

test("served verification requires API health, environment header, API URL and release hash", async t => {
  let health = "ok";
  let header = "staging";
  let release = { environment: "staging", apiUrl: "https://testes.laudaapp.com/api", sourceHash: "a".repeat(64) };
  const expected = { ...release };
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("X-Lauda-Environment", header);
    res.end(JSON.stringify(req.url === "/health" ? { status: health } : release));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const gateway = `http://127.0.0.1:${server.address().port}`;
  const env = { name: "staging", apiUrl: expected.apiUrl, gateway, health: `${gateway}/health` };
  await core.verifyServed(env, expected);
  for (const change of [{ sourceHash: "bad" }, { environment: "production" }, { apiUrl: "https://api.laudaapp.com/api" }]) {
    release = { ...expected, ...change };
    await assert.rejects(core.verifyServed(env, expected));
  }
  release = expected;
  header = "production";
  await assert.rejects(core.verifyServed(env, expected), /Unexpected web gateway/);
  header = "staging";
  health = "failed";
  await assert.rejects(core.verifyServed(env, expected), /API health check failed/);
});
