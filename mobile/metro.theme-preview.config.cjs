const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const { FileStore } = require("metro-cache");
const base = require("./metro.config.js");
const cacheRoot = path.join(os.tmpdir(), "lauda-theme-preview-8094");
fs.mkdirSync(path.join(cacheRoot, "file-map"), { recursive: true });
module.exports = {
  ...base,
  cacheVersion: "lauda-theme-preview-8094-v1",
  cacheStores: [new FileStore({ root: path.join(cacheRoot, "transforms") })],
  fileMapCacheDirectory: path.join(cacheRoot, "file-map"),
};
