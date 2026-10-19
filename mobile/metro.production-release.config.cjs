const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const { FileStore } = require("metro-cache");
const base = require("./metro.config.js");

// Keep public API transforms separate from development and acceptance caches.
const cacheRoot = path.join(os.tmpdir(), "lauda-production-release");
fs.mkdirSync(path.join(cacheRoot, "file-map"), { recursive: true });
module.exports = {
  ...base,
  cacheVersion: "lauda-production-api-public-v1",
  cacheStores: [new FileStore({ root: path.join(cacheRoot, "transforms") })],
  fileMapCacheDirectory: path.join(cacheRoot, "file-map"),
};
