"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const core = require("./core.cjs");

async function processNext(root, runtime) {
  const base = path.join(root, ".lauda-publisher");
  for (const filename of fs.readdirSync(path.join(base, "inbox")).sort()) {
    if (!core.ID.test(filename.replace(/\.json$/, "")) || !filename.endsWith(".json")) continue;
    const source = core.plainPath(root, path.join(base, "inbox", filename));
    const claimed = core.plainPath(root, path.join(base, "processing", filename), true);
    const result = core.plainPath(root, path.join(base, "results", filename), true);
    if (fs.existsSync(result)) { fs.renameSync(source, `${source}.duplicate`); continue; }
    fs.renameSync(source, claimed);
    let request;
    let outcome;
    try {
      if (fs.statSync(claimed).size > 2048) throw new Error("Publication request exceeds 2 KB");
      request = core.validateRequest(core.readJson(claimed), filename);
      const data = request.action === "status" ? await runtime.status() : request.action.startsWith("restart-")
        ? await runtime.restart(core.environment(root, request.action.slice(8)))
        : await core.publish(root, core.environment(root, request.action.slice(8)), runtime);
      outcome = { id: request.id, action: request.action, status: "completed", data };
    } catch (error) {
      outcome = { id: filename.slice(0, -5), action: request?.action, status: "failed", error: error.message.slice(0, 12000) };
    }
    core.writeJson(result, { ...outcome, finishedAt: new Date().toISOString() });
    fs.unlinkSync(claimed);
    return true;
  }
  return false;
}

function runtimeFor(root, powershell) {
  const helper = (operation, env) => core.exec(powershell, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", path.join(__dirname, "processes.ps1"), "-Operation", operation, "-Environment", env.name, "-ProjectRoot", root], { cwd: root });
  return {
    inspect: env => helper("Inspect", env),
    restart: env => helper("Restart", env),
    pauseWeb: env => helper("PauseWeb", env),
    resumeWeb: env => helper("ResumeWeb", env),
    validate: env => core.exec(process.execPath, [path.join(root, "scripts/validate-frontend-api.cjs"), "--dist", env.nextWeb, "--expected-api-url", env.apiUrl], { cwd: root }),
    verify: core.verifyServed,
    async status() {
      const services = {};
      for (const name of ["staging", "production"]) {
        const env = core.environment(root, name);
        try { services[name] = { health: await core.jsonUrl(env.health) }; }
        catch (error) { services[name] = { error: error.message }; }
        try { services[name].processManagement = await helper("Inspect", env); }
        catch (error) { services[name].processManagementError = error.message; }
      }
      return { account: os.userInfo().username, services };
    },
  };
}

function recoverInterrupted(root) {
  const base = path.join(root, ".lauda-publisher");
  for (const filename of fs.readdirSync(path.join(base, "processing"))) {
    if (!core.ID.test(filename.slice(0, -5)) || !filename.endsWith(".json")) continue;
    const result = path.join(base, "results", filename);
    if (!fs.existsSync(result)) core.writeJson(result, { id: filename.slice(0, -5), status: "interrupted", error: "Publisher stopped during this request. Inspect active release and backups before retrying.", finishedAt: new Date().toISOString() });
    fs.unlinkSync(core.plainPath(root, path.join(base, "processing", filename)));
  }
}

async function main(configPath) {
  const config = core.readJson(configPath);
  const root = fs.realpathSync(config.projectRoot);
  const base = path.join(root, ".lauda-publisher");
  for (const folder of ["inbox", "processing", "results"]) core.plainPath(root, path.join(base, folder));
  const lockPath = path.join(base, "worker.lock");
  if (fs.existsSync(lockPath)) {
    const lock = core.readJson(lockPath);
    try { process.kill(lock.pid, 0); throw new Error("Publisher already running or its PID is in use"); }
    catch (error) { if (error.code !== "ESRCH") throw error; }
    fs.unlinkSync(lockPath);
  }
  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid }), { flag: "wx" });
  // A host shutdown during publication is ambiguous; never automatically replay it.
  recoverInterrupted(root);
  const heartbeat = () => core.writeJson(path.join(base, "state.json"), { pid: process.pid, account: os.userInfo().username, heartbeat: new Date().toISOString(), projectRoot: root, version: 1 });
  heartbeat();
  const timer = setInterval(heartbeat, 2000);
  const cleanup = () => { clearInterval(timer); try { fs.unlinkSync(lockPath); } catch {} };
  process.on("exit", cleanup);
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => process.exit(0));
  const runtime = runtimeFor(root, config.powershell);
  while (true) {
    try { await processNext(root, runtime); }
    catch (error) { fs.appendFileSync(path.join(base, "worker.log"), `${new Date().toISOString()} ${error.message}\n`); }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

if (require.main === module) main(process.argv[2]).catch(error => {
  console.error(error.message);
  try {
    const config = core.readJson(process.argv[2]);
    fs.appendFileSync(path.join(config.projectRoot, ".lauda-publisher", "worker.log"), `${new Date().toISOString()} STARTUP: ${error.message}\n`);
  } catch {}
  process.exitCode = 1;
});
module.exports = { processNext, runtimeFor, recoverInterrupted };
