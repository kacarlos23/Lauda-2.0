"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const core = require("./publisher/core.cjs");

async function main(args, root = path.resolve(__dirname, "..")) {
  const base = path.join(root, ".lauda-publisher");
  if (args[0] === "--result" && args.length === 2 && core.ID.test(args[1])) {
    const file = path.join(base, "results", `${args[1]}.json`);
    if (!fs.existsSync(file)) throw new Error("No final result yet. Check processing/inbox and worker state; do not resubmit automatically.");
    const result = core.readJson(file);
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== "completed") process.exitCode = 1;
    return;
  }
  if (args.length !== 1 || !core.ACTIONS.includes(args[0])) throw new Error(`Usage: node scripts/request-publication.cjs <${core.ACTIONS.join("|")}> OR --result <request-id>`);
  if (!fs.existsSync(path.join(base, "state.json"))) throw new Error("Publisher has no heartbeat. No request was queued. If Lauda-Publisher is already registered, inspect .lauda-publisher/installation-*.json and run scripts/install-publisher.ps1 -Repair in an administrator PowerShell; otherwise install it once.");
  const state = core.readJson(path.join(base, "state.json"));
  const age = Date.now() - Date.parse(state.heartbeat);
  if (!Number.isFinite(age) || age < -30_000 || age > 10_000) throw new Error("Publisher heartbeat is stale. Check the Lauda-Publisher Windows task before sending a request.");
  const id = randomUUID();
  const request = { id, action: args[0], createdAt: new Date().toISOString() };
  core.plainPath(root, path.join(base, "inbox"));
  core.writeJson(path.join(base, "inbox", `${id}.json`), request);
  console.log(`Request: ${id}\nAction: ${request.action}\nPublisher account: ${state.account}`);
  const deadline = Date.now() + 300_000;
  const resultPath = path.join(base, "results", `${id}.json`);
  while (Date.now() < deadline) {
    if (fs.existsSync(resultPath)) {
      const result = core.readJson(resultPath);
      console.log(JSON.stringify(result, null, 2));
      if (result.status !== "completed") process.exitCode = 1;
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.error(`Result pending. Do not resubmit. Check: node scripts/request-publication.cjs --result ${id}`);
  process.exitCode = 2;
}

if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { main };
