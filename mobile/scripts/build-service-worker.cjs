"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const EXCLUDED_ROOT_FILES = new Set([
  "sw.js",
  "sw-manifest.json",
  "release.json",
  "apk-release.json",
]);

const EXCLUDED_EXTENSIONS = new Set([".map", ".apk", ".tmp"]);

const PRECACHE_STATIC_EXTS = new Set([
  ".html",
  ".js",
  ".css",
  ".webmanifest",
  ".ico",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
]);

function walkFiles(directory, baseDirectory = directory) {
  if (!fs.existsSync(directory)) return [];
  const collected = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".well-known") continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collected.push(...walkFiles(fullPath, baseDirectory));
    } else if (entry.isFile()) {
      const relative = path.relative(baseDirectory, fullPath).replace(/\\/g, "/");
      collected.push({ fullPath, relative });
    }
  }
  return collected;
}

const EXCLUDED_HTML_FILES = new Set(["_sitemap.html", "+not-found.html"]);

function shouldPrecacheFile(relative) {
  if (EXCLUDED_ROOT_FILES.has(relative) || EXCLUDED_HTML_FILES.has(relative)) return false;
  if (relative.startsWith("(auth)/") || relative.startsWith("(tabs)/")) return false;
  const ext = path.extname(relative).toLowerCase();
  if (EXCLUDED_EXTENSIONS.has(ext)) return false;
  if (relative.startsWith("_expo/static/")) {
    return ext === ".js" || ext === ".css";
  }
  return PRECACHE_STATIC_EXTS.has(ext);
}

function collectPrecacheUrls(distDir) {
  const resolvedDist = path.resolve(distDir);
  const files = walkFiles(resolvedDist)
    .filter((file) => shouldPrecacheFile(file.relative))
    .sort((left, right) => left.relative.localeCompare(right.relative));

  return files.map((file) => ({
    url: `/${file.relative}`,
    fullPath: file.fullPath,
    relative: file.relative,
  }));
}

function computeCacheVersion(entries, extraSeed = "") {
  const hash = crypto.createHash("sha256");
  for (const entry of entries) {
    hash.update(entry.url);
    hash.update("\0");
    hash.update(fs.readFileSync(entry.fullPath));
    hash.update("\0");
  }
  if (extraSeed) {
    hash.update(extraSeed);
  }
  return hash.digest("hex").slice(0, 12);
}

function extractDynamicRewrites(serveJsonPath) {
  if (!serveJsonPath || !fs.existsSync(serveJsonPath)) return [];
  const config = JSON.parse(fs.readFileSync(serveJsonPath, "utf8"));
  const rewrites = Array.isArray(config.rewrites) ? config.rewrites : [];
  return rewrites
    .filter((rule) => typeof rule.source === "string" && typeof rule.destination === "string" && rule.source.includes(":id("))
    .map((rule) => ({
      pattern: `^${rule.source.replace(/:id\(([^)]+)\)/g, "($1)")}/?$`,
      destination: rule.destination.startsWith("/") ? rule.destination : `/${rule.destination}`,
    }));
}

function buildServiceWorkerSource({ version, urls, dynamicRewrites }) {
  const cacheName = `lauda-shell-${version}`;
  const serializedUrls = JSON.stringify(urls, null, 2);
  const serializedRewrites = JSON.stringify(dynamicRewrites, null, 2);

  return `/* Lauda Service Worker — gerado automaticamente; versão ${version} */
"use strict";

const CACHE_PREFIX = "lauda-shell-";
const CACHE_NAME = ${JSON.stringify(cacheName)};
const PRECACHE_URLS = ${serializedUrls};
const PRECACHE_SET = new Set(PRECACHE_URLS);
const DYNAMIC_REWRITES = ${serializedRewrites}.map((rule) => ({
  regex: new RegExp(rule.pattern),
  destination: rule.destination,
}));

const BYPASS_PATHS = new Set([
  "/health",
  "/release.json",
  "/apk-release.json",
  "/sw.js",
  "/sw-manifest.json",
]);

function shouldBypass(request, url) {
  if (request.method !== "GET") return true;
  if (url.origin !== self.location.origin) return true;
  if (request.headers && request.headers.has("authorization")) return true;
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return true;
  if (BYPASS_PATHS.has(url.pathname)) return true;
  if (/\\.(?:apk|pdf|map)$/i.test(url.pathname)) return true;
  return false;
}

async function fetchCleanForCache(url) {
  const response = await fetch(new Request(url, { cache: "reload" }));
  if (!response.ok) {
    throw new Error("Falha ao armazenar recurso no cache offline: " + url + " (" + response.status + ")");
  }
  if (response.redirected) {
    const body = await response.arrayBuffer();
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers),
    });
  }
  return response;
}

function candidateHtmlPaths(pathname) {
  const clean = pathname.length > 1 ? pathname.replace(/\\/+$/, "") : "/";
  const candidates = [];
  if (clean === "/") {
    candidates.push("/index.html");
    return candidates;
  }
  candidates.push(clean);
  if (!clean.endsWith(".html")) {
    candidates.push(clean + ".html");
    candidates.push(clean + "/index.html");
  }
  for (const rule of DYNAMIC_REWRITES) {
    if (rule.regex.test(clean)) {
      candidates.push(rule.destination);
    }
  }
  candidates.push("/index.html");
  return candidates;
}

async function matchCachedNavigation(pathname) {
  const cache = await caches.open(CACHE_NAME);
  for (const candidate of candidateHtmlPaths(pathname)) {
    const match = await cache.match(candidate);
    if (match) return match;
  }
  return Response.error();
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const batchSize = 8;
      for (let index = 0; index < PRECACHE_URLS.length; index += batchSize) {
        const chunk = PRECACHE_URLS.slice(index, index + batchSize);
        await Promise.all(
          chunk.map(async (url) => {
            const response = await fetchCleanForCache(url);
            await cache.put(url, response);
          })
        );
      }
      if (!self.registration || !self.registration.active) {
        await self.skipWaiting();
      }
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (shouldBypass(event.request, url)) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => matchCachedNavigation(url.pathname))
    );
    return;
  }

  if (PRECACHE_SET.has(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(url.pathname);
        if (cached) return cached;
        return fetch(event.request);
      })
    );
  }
});
`;
}

function generateServiceWorker(options = {}) {
  const distDir = path.resolve(options.distDir || path.resolve(__dirname, "..", "dist"));
  const serveJsonPath = path.resolve(options.serveJsonPath || path.resolve(__dirname, "..", "serve.json"));

  if (!fs.existsSync(distDir)) {
    throw new Error(`Diretório de exportação não encontrado: ${distDir}`);
  }

  const entries = collectPrecacheUrls(distDir);
  if (entries.length === 0) {
    throw new Error(`Nenhum arquivo público encontrado para pré-cache em ${distDir}`);
  }

  const dynamicRewrites = extractDynamicRewrites(serveJsonPath);
  const version = computeCacheVersion(entries, JSON.stringify(dynamicRewrites));
  const urls = entries.map((entry) => entry.url);
  const swSource = buildServiceWorkerSource({ version, urls, dynamicRewrites });

  const manifest = {
    version,
    cacheName: `lauda-shell-${version}`,
    generatedAt: new Date().toISOString(),
    filesCount: urls.length,
    dynamicRewritesCount: dynamicRewrites.length,
    files: urls,
  };

  fs.writeFileSync(path.join(distDir, "sw.js"), swSource, "utf8");
  fs.writeFileSync(path.join(distDir, "sw-manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");

  return manifest;
}

function parseDistArg(argv) {
  let distDir = path.resolve(__dirname, "..", "dist");
  let serveJsonPath = path.resolve(__dirname, "..", "serve.json");
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dist" && argv[index + 1]) {
      distDir = argv[index + 1];
      index += 1;
    } else if (arg === "--serve-json" && argv[index + 1]) {
      serveJsonPath = argv[index + 1];
      index += 1;
    }
  }
  return { distDir, serveJsonPath };
}

if (require.main === module) {
  const { distDir, serveJsonPath } = parseDistArg(process.argv.slice(2));
  const manifest = generateServiceWorker({ distDir, serveJsonPath });
  console.log(`[service-worker] OK: ${manifest.cacheName} (${manifest.filesCount} arquivos, ${manifest.dynamicRewritesCount} rewrites dinâmicos)`);
}

module.exports = {
  buildServiceWorkerSource,
  collectPrecacheUrls,
  computeCacheVersion,
  extractDynamicRewrites,
  generateServiceWorker,
};
