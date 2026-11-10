"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const root = path.resolve(__dirname, "../..");
const target = path.join(root, "staging-artifacts");
const commit = process.env.GITHUB_SHA;
const apiUrl = "https://testes.laudaapp.com/api";
if (!/^[a-f0-9]{40}$/.test(commit) || process.env.EXPO_PUBLIC_API_URL !== apiUrl) {
  throw new Error("Expected a staging build with a Git commit");
}
fs.mkdirSync(target);
fs.cpSync(path.join(root, "dist"), path.join(target, "backend"), { recursive: true });
fs.cpSync(path.join(root, "mobile/dist"), path.join(target, "web"), { recursive: true });
for (const file of ["package.json", "package-lock.json", "prisma.config.ts", "prisma"]) {
  fs.cpSync(path.join(root, file), path.join(target, "backend", file), { recursive: true });
}

const hash = createHash("sha256").update(commit);
function hashFiles(directory, relative = "") {
  for (const name of fs.readdirSync(directory).sort()) {
    const file = path.join(directory, name);
    const label = relative + name;
    const entry = fs.lstatSync(file);
    if (entry.isDirectory()) hashFiles(file, label + "/");
    else if (entry.isFile()) hash.update(JSON.stringify([label, entry.size])).update(fs.readFileSync(file));
    else throw new Error("Unexpected release file type");
  }
}
hashFiles(target);
const release = { environment: "staging", commit, sourceHash: hash.digest("hex"), builtAt: new Date().toISOString() };
fs.writeFileSync(path.join(target, "web/release.json"), JSON.stringify({ ...release, apiUrl, backendCommit: commit }));
fs.writeFileSync(path.join(target, "backend/release.json"), JSON.stringify(release));
