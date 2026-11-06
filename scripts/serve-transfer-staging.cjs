"use strict";

// Uses the existing isolated staging configuration; production paths are read-only.
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const express = require("express");
const root = path.resolve(__dirname, "..");
const stagingRoot = process.env.LAUDA_STAGING_ROOT || path.join(process.env.USERPROFILE, ".codex/worktrees/public-test-environment/Lauda 2.0");
const { childEnvironment } = require(path.join(stagingRoot, "scripts/public-test-config.cjs"));
const gatewayPort = Number(process.env.LAUDA_STAGING_GATEWAY_PORT || 8095);
const backendPort = Number(process.env.LAUDA_STAGING_BACKEND_PORT || 3020);
if (![8095, 8096].includes(gatewayPort) || ![3020, 3021].includes(backendPort)) throw new Error("Invalid staging ports");
const env = { ...childEnvironment(), PORT: String(backendPort) };
const output = path.join(root, "mobile/web-build/transfer-staging");
const oldOutput = path.join(stagingRoot, "mobile/web-build/public-test");
const compiled = path.join(root, "test-results/transfer-release/backend/server.js");
if (!fs.existsSync(compiled) || !fs.existsSync(path.join(output, "release.json"))) throw new Error("Build and validate the staging release first");
const logs = path.join(root, "test-results/transfer-release");
let backend;
let closing = false;
function startBackend() {
  const fd = fs.openSync(path.join(logs, `backend-${backendPort}.log`), "a");
  backend = spawn(process.execPath, [compiled], { cwd: root, env, windowsHide: true, stdio: ["ignore", fd, fd] });
  fs.closeSync(fd);
  backend.on("exit", () => { if (!closing) setTimeout(startBackend, 3000); });
}
const app = express();
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Lauda-Environment", "staging");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.setHeader("Content-Security-Policy", "connect-src 'self' https://testes.laudaapp.com wss://testes.laudaapp.com");
  next();
});
app.get("/robots.txt", (_req, res) => res.type("text/plain").send("User-agent: *\nDisallow: /\n"));
app.use((req, res, next) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (/^\/api\/docs(?:\/|$)/.test(pathname)) return res.sendStatus(404);
  if (!(pathname === "/health" || pathname === "/api" || pathname.startsWith("/api/"))) return next();
  const upstream = http.request({ hostname: "127.0.0.1", port: backendPort, path: req.url, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${backendPort}` } }, response => {
    res.statusCode = response.statusCode;
    for (const [key, value] of Object.entries(response.headers)) if (value !== undefined && !["access-control-allow-origin", "transfer-encoding", "connection"].includes(key)) res.setHeader(key, value);
    res.setHeader("Cache-Control", "no-store");
    response.pipe(res);
  });
  // Imports allow 120 seconds in the database plus response and network overhead.
  upstream.setTimeout(150_000, () => upstream.destroy());
  upstream.on("error", () => { if (!res.headersSent) res.status(502).json({ error: "Não foi possível concluir a operação no ambiente de testes. Confira o resultado antes de tentar novamente." }); else res.destroy(); });
  req.on("aborted", () => upstream.destroy());
  req.pipe(upstream);
});
const rewrites = require("./worship-test.serve.json").rewrites.filter(rule => rule.source.includes(":id(")).map(rule => ({ pattern: new RegExp("^" + rule.source.replace(/:id\(([^)]+)\)/g, "($1)") + "/?$"), file: rule.destination.slice(1) }));
app.use((req, res, next) => {
  if (!["GET", "HEAD"].includes(req.method)) return next();
  const match = rewrites.find(rule => rule.pattern.test(new URL(req.url, "http://localhost").pathname));
  if (!match) return next();
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(match.file, { root: output });
});
app.use(express.static(output, { extensions: ["html"], setHeaders(res, file) { res.setHeader("Cache-Control", /\.(html|json)$/.test(file) ? "no-store" : "public, max-age=3600"); } }));
// Already-open tabs can still fetch assets from the preceding staging release.
app.use("/_expo", express.static(path.join(oldOutput, "_expo")));
app.use("/assets", express.static(path.join(oldOutput, "assets")));
app.use((req, res) => {
  if (path.extname(new URL(req.url, "http://localhost").pathname)) return res.sendStatus(404);
  res.setHeader("Cache-Control", "no-store");
  res.sendFile("index.html", { root: output });
});
const server = app.listen(gatewayPort, "127.0.0.1", () => { console.log(`Staging gateway ready on ${gatewayPort}`); startBackend(); });
server.on("error", error => { console.error(error.message); process.exit(1); });
function close() { closing = true; backend?.kill(); server.close(() => process.exit()); }
process.on("SIGINT", close);
process.on("SIGTERM", close);
