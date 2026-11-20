"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  collectPrecacheUrls,
  generateServiceWorker,
} = require("../mobile/scripts/build-service-worker.cjs");

function createFakeExpoDist(rootDir) {
  const files = {
    "index.html": "<html><head><title>Lauda</title></head><body>Home</body></html>",
    "login.html": "<html><head><title>Entrar | Lauda</title></head><body>Login</body></html>",
    "(tabs)/index.html": "<html><head><title>Home | Lauda</title></head><body>TabsHome</body></html>",
    "(auth)/login.html": "<html><head><title>Auth | Lauda</title></head><body>AuthLogin</body></html>",
    "_sitemap.html": "<html><head><title>Sitemap</title></head><body>Sitemap</body></html>",
    "+not-found.html": "<html><head><title>NotFound</title></head><body>NotFound</body></html>",
    "songs/[id].html": "<html><head><title>Cifra | Lauda</title></head><body>Song</body></html>",
    "schedules/[id]/edit.html": "<html><head><title>Editar | Lauda</title></head><body>Edit</body></html>",
    "site.webmanifest": '{"name":"Lauda"}',
    "favicon.ico": "ico",
    "favicon.svg": "<svg/>",
    "icons/icon-192.png": "png192",
    "icons/icon-maskable-512.png": "png512",
    "_expo/static/js/web/entry-abc123.js": "console.log('entry');",
    "_expo/static/js/web/route-songs-def456.js": "console.log('songs-chunk');",
    "_expo/static/js/web/entry-abc123.js.map": '{"version":3}',
    "release.json": '{"commit":"1234"}',
    "apk-release.json": '{"available":false}',
  };

  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(rootDir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
  }
}

describe("build-service-worker.cjs", () => {
  it("inventaria HTMLs, chunks assíncronos e ativos públicos excluindo mapas e manifestos mutáveis", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lauda-sw-test-"));
    try {
      createFakeExpoDist(tempDir);
      const entries = collectPrecacheUrls(tempDir).map((entry) => entry.url);

      assert.ok(entries.includes("/index.html"));
      assert.ok(entries.includes("/login.html"));
      assert.ok(entries.includes("/songs/[id].html"));
      assert.ok(entries.includes("/_expo/static/js/web/entry-abc123.js"));
      assert.ok(entries.includes("/_expo/static/js/web/route-songs-def456.js"));
      assert.ok(entries.includes("/site.webmanifest"));
      assert.ok(entries.includes("/icons/icon-maskable-512.png"));

      assert.equal(entries.includes("/release.json"), false);
      assert.equal(entries.includes("/apk-release.json"), false);
      assert.equal(entries.includes("/_expo/static/js/web/entry-abc123.js.map"), false);
      assert.equal(entries.includes("/(tabs)/index.html"), false);
      assert.equal(entries.includes("/(auth)/login.html"), false);
      assert.equal(entries.includes("/_sitemap.html"), false);
      assert.equal(entries.includes("/+not-found.html"), false);

      const serveJson = path.resolve(__dirname, "..", "mobile", "serve.json");
      const first = generateServiceWorker({ distDir: tempDir, serveJsonPath: serveJson });
      const second = generateServiceWorker({ distDir: tempDir, serveJsonPath: serveJson });
      assert.equal(first.version, second.version);
      assert.match(first.cacheName, /^lauda-shell-[a-f0-9]{12}$/);

      const swSource = fs.readFileSync(path.join(tempDir, "sw.js"), "utf8");
      assert.ok(swSource.includes("/_expo/static/js/web/route-songs-def456.js"));
      assert.ok(swSource.includes('url.pathname.startsWith("/api/")'));
      assert.ok(swSource.includes("/songs/[id].html"));
      assert.ok(swSource.includes('request.headers.has("authorization")'));

      // Alterar um chunk deve gerar nova versão de cache
      fs.writeFileSync(path.join(tempDir, "_expo/static/js/web/route-songs-def456.js"), "console.log('updated');", "utf8");
      const third = generateServiceWorker({ distDir: tempDir, serveJsonPath: serveJson });
      assert.notEqual(third.version, first.version);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
