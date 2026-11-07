"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");
const ACTIONS = Object.freeze(["status", "publish-staging", "restart-staging", "publish-production", "restart-production"]);
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")); }
function writeJson(file, value) {
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), { flag: "wx" });
  fs.renameSync(temp, file);
}
function plainPath(root, target, allowMissing = false) {
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) throw new Error("Path outside publication root");
  let current = root;
  for (const part of ["", ...relative.split(path.sep)]) {
    current = path.join(current, part);
    if (!fs.existsSync(current)) { if (allowMissing) continue; throw new Error(`Missing path: ${current}`); }
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error("Reparse points are not allowed in publication paths");
  }
  return target;
}
function validateRequest(request, filename, now = Date.now()) {
  if (!request || typeof request !== "object" || Array.isArray(request) ||
      Object.keys(request).sort().join(",") !== "action,createdAt,id" ||
      !ID.test(request.id) || filename !== `${request.id}.json` || !ACTIONS.includes(request.action)) throw new Error("Invalid publication request");
  const age = now - Date.parse(request.createdAt);
  if (!Number.isFinite(age) || age < -30_000 || age > 600_000) throw new Error("Expired publication request; submit a new request after checking the previous result");
  return request;
}
function environment(root, name) {
  const staging = name === "staging";
  if (!staging && name !== "production") throw new Error("Unknown environment");
  return {
    name, apiUrl: staging ? "https://testes.laudaapp.com/api" : "https://api.laudaapp.com/api",
    gateway: staging ? "http://127.0.0.1:8095" : "http://127.0.0.1:8081",
    health: staging ? "http://127.0.0.1:8095/health" : "http://127.0.0.1:3000/health",
    web: path.join(root, staging ? "mobile/web-build/transfer-staging" : "mobile/dist"),
    nextWeb: path.join(root, staging ? "mobile/web-build/transfer-staging-next" : "mobile/web-build/production-next"),
    api: path.join(root, staging ? "test-results/transfer-release/backend" : "dist"),
    nextApi: path.join(root, staging ? "test-results/transfer-release/backend-next" : "test-results/production-release/backend-next"),
  };
}
function checkTree(root, directory) {
  plainPath(root, directory);
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = plainPath(root, path.join(directory, entry.name));
    if (entry.isDirectory()) checkTree(root, file);
    else if (!entry.isFile()) throw new Error("Release contains a non-regular file");
  }
}
function checkRelease(root, env) {
  checkTree(root, env.nextWeb);
  checkTree(root, env.nextApi);
  for (const file of [path.join(env.nextWeb, "index.html"), path.join(env.nextApi, "server.js")]) plainPath(root, file);
  const web = readJson(path.join(env.nextWeb, "release.json"));
  const api = readJson(path.join(env.nextApi, "release.json"));
  if (web.environment !== env.name || api.environment !== env.name || web.apiUrl !== env.apiUrl) throw new Error("Release environment/API mismatch");
  if (!/^[a-f0-9]{64}$/.test(web.sourceHash) || api.sourceHash !== web.sourceHash) throw new Error("Frontend and backend must have the same SHA-256 sourceHash");
  if (env.name === "production" && (!/^[a-f0-9]{40}$/.test(web.commit) || web.backendCommit !== web.commit || api.commit !== web.commit)) throw new Error("Production release must identify the same Git commit in both manifests");
  return web;
}
function exec(file, args, options = {}) {
  return new Promise((resolve, reject) => execFile(file, args, { windowsHide: true, encoding: "utf8", timeout: 150_000, maxBuffer: 2 * 1024 * 1024, ...options }, (error, stdout, stderr) => {
    if (error) reject(new Error(`${error.message}\n${stderr || stdout}`));
    else resolve(stdout.trim());
  }));
}
async function jsonUrl(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}
async function verifyServed(env, expected) {
  const health = await jsonUrl(env.health);
  if (health.status !== "ok") throw new Error("API health check failed");
  const response = await fetch(`${env.gateway}/release.json`, { signal: AbortSignal.timeout(5000), cache: "no-store" });
  if (!response.ok || (env.name === "staging" && response.headers.get("x-lauda-environment") !== "staging")) throw new Error("Unexpected web gateway");
  const actual = await response.json();
  if (actual.sourceHash !== expected.sourceHash || actual.environment !== env.name || actual.apiUrl !== env.apiUrl) throw new Error("Gateway is serving a different release");
}

function treeFiles(root, directory) {
  checkTree(root, directory);
  const files = [];
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) visit(file);
      else files.push(path.relative(directory, file));
    }
  }
  visit(directory);
  return files;
}
function copyWebFiles(root, source, destination) {
  const priority = file => file === "release.json" ? 2 : file.endsWith(".html") ? 1 : 0;
  const files = treeFiles(root, source).sort((a, b) => priority(a) - priority(b) || a.localeCompare(b));
  for (const relative of files) {
    const from = plainPath(root, path.join(source, relative));
    const to = plainPath(root, path.join(destination, relative), true);
    if (fs.existsSync(to) && fs.readFileSync(from).equals(fs.readFileSync(to))) continue;
    fs.mkdirSync(path.dirname(to), { recursive: true });
    const temporary = plainPath(root, `${to}.${process.pid}.${Date.now()}.publish.tmp`, true);
    try {
      fs.copyFileSync(from, temporary, fs.constants.COPYFILE_EXCL);
      fs.renameSync(temporary, to);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
}
function restoreWebFiles(root, item) {
  copyWebFiles(root, item.backup, item.live);
  // Remove only the candidate files absent from the saved release. Cached old
  // assets already in the live tree are never deleted during activation.
  for (const relative of item.addedFiles) {
    const file = plainPath(root, path.join(item.live, relative), true);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}

// Only prebuilt artifacts are activated. No builds, migrations, shell input or network listener.
async function publish(root, env, runtime) {
  const release = checkRelease(root, env);
  await runtime.validate(env);
  await runtime.inspect(env); // Refuse unknown processes before changing any live files.
  const suffix = `-before-${Date.now()}`;
  const moved = [];
  try {
    for (const [live, next] of [[env.api, env.nextApi], [env.web, env.nextWeb]]) {
      plainPath(root, live); plainPath(root, `${live}${suffix}`, true);
      try { fs.renameSync(live, `${live}${suffix}`); }
      catch (error) {
        // Windows can refuse renaming an open web directory even though its
        // individual files remain writable. Keep that directory and its handles.
        if (live !== env.web || !["EPERM", "EBUSY", "EACCES"].includes(error.code) || !fs.existsSync(live) || fs.existsSync(`${live}${suffix}`)) throw error;
        const oldFiles = new Set(treeFiles(root, live));
        const addedFiles = treeFiles(root, next).filter(file => !oldFiles.has(file));
        fs.cpSync(live, `${live}${suffix}`, { recursive: true, force: false, errorOnExist: true });
        const item = { live, next, backup: `${live}${suffix}`, mode: "files", addedFiles };
        moved.push(item);
        copyWebFiles(root, next, live); // Assets first, HTML next, release manifest last.
        continue;
      }
      moved.push({ live, next, backup: `${live}${suffix}`, activated: false });
      fs.renameSync(next, live);
      moved[moved.length - 1].activated = true;
    }
    await runtime.restart(env);
    await runtime.verify(env, release);
    return { environment: env.name, sourceHash: release.sourceHash, backups: moved.map(item => item.backup), webActivation: moved.find(item => item.live === env.web)?.mode || "directory" };
  } catch (error) {
    const rollbackErrors = [];
    for (const item of moved.reverse()) {
      try {
        if (item.mode === "files") restoreWebFiles(root, item);
        else {
          if (item.activated) fs.renameSync(item.live, item.next);
          fs.renameSync(item.backup, item.live);
        }
      } catch (rollbackError) { rollbackErrors.push(rollbackError.message); }
    }
    if (moved.length && !rollbackErrors.length) {
      try { await runtime.restart(env); } catch (restartError) { rollbackErrors.push(restartError.message); }
    }
    throw new Error(`${error.message}; rollback ${rollbackErrors.length ? `requires attention: ${rollbackErrors.join("; ")}` : "completed; previous files restored"}`);
  }
}

module.exports = { ACTIONS, ID, readJson, writeJson, plainPath, validateRequest, environment, checkRelease, exec, jsonUrl, verifyServed, publish };
