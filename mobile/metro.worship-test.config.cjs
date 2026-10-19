const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const { FileStore } = require("metro-cache");
const base = require("./metro.config.js");

// Keep test transforms separate from the running production Metro/build caches.
const cacheRoot = path.join(os.tmpdir(), "lauda-worship-test-3010");
fs.mkdirSync(path.join(cacheRoot, "file-map"), { recursive: true });
module.exports = {
  ...base,
  cacheVersion: "lauda-worship-test-api-3010-v1",
  cacheStores: [new FileStore({ root: path.join(cacheRoot, "transforms") })],
  fileMapCacheDirectory: path.join(cacheRoot, "file-map"),
};
