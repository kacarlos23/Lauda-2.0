const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const express = require("express");
const { root, childEnvironment } = require("./public-test-config.cjs");
const env = childEnvironment();
const output = path.join(root, "mobile/web-build/public-test");
if (!fs.existsSync(path.join(output, "release.json"))) throw new Error("Build the public test frontend first.");
const logs = path.join(root, "test-results/public-test");
fs.mkdirSync(logs, { recursive: true });
let backend;
let closing = false;
function startBackend() {
  const out = fs.openSync(path.join(logs, "backend.log"), "a");
  backend = spawn(process.execPath, [path.join(root, "dist/server.js")], { cwd: root, env, windowsHide: true, stdio: ["ignore", out, out] });
  fs.closeSync(out);
  backend.on("exit", () => { if (!closing) setTimeout(startBackend, 3000); });
}
startBackend();
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
  const upstream = http.request({ hostname: "127.0.0.1", port: 3020, path: req.url, method: req.method, headers: { ...req.headers, host: "127.0.0.1:3020" } }, response => {
    res.statusCode = response.statusCode;
    for (const [key, value] of Object.entries(response.headers)) if (value !== undefined && !["access-control-allow-origin", "transfer-encoding", "connection"].includes(key)) res.setHeader(key, value);
    res.setHeader("Cache-Control", "no-store");
    response.pipe(res);
  });
  upstream.setTimeout(30000, () => upstream.destroy());
  upstream.on("error", () => { if (!res.headersSent) res.status(502).json({ error: "Ambiente de testes iniciando. Tente novamente." }); else res.destroy(); });
  req.pipe(upstream);
});
// Expo exports templates for dynamic routes. Match the existing acceptance server rewrites.
const dynamicRewrites = require("./worship-test.serve.json").rewrites
  .filter(rule => rule.source.includes(":id("))
  .map(rule => ({ pattern: new RegExp("^" + rule.source.replace(/:id\(([^)]+)\)/g, "($1)") + "/?$"), file: rule.destination.slice(1) }));
app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  const pathname = new URL(req.url, "http://localhost").pathname;
  const route = dynamicRewrites.find(rule => rule.pattern.test(pathname));
  if (!route) return next();
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(route.file, { root: output });
});
app.use(express.static(output, { extensions: ["html"], setHeaders(res, file) { res.setHeader("Cache-Control", /\.(html|json)$/.test(file) ? "no-store" : "public, max-age=3600"); } }));
app.use((req, res) => {
  if (path.extname(new URL(req.url, "http://localhost").pathname)) return res.sendStatus(404);
  res.setHeader("Cache-Control", "no-store");
  res.sendFile("index.html", { root: output });
});
const server = app.listen(8095, "127.0.0.1", () => console.log("Public test gateway listening on 127.0.0.1:8095"));
function close() { closing = true; backend?.kill(); server.close(() => process.exit()); }
process.on("SIGINT", close);
process.on("SIGTERM", close);
