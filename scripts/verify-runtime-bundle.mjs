#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import receipt from "./security/runtime-audit-receipt.cjs";

const targetPackages = new Set(["picomatch"]);
const { root, platforms, execution, receiptPath, checkout, clearReceipt } = receipt;

function readSources(map, inheritedRoot = "") {
  if (map?.version !== 3) throw new Error("Source map has an unsupported format");
  const sourceRoot = typeof map.sourceRoot === "string"
    ? [inheritedRoot, map.sourceRoot].filter(Boolean).join("/")
    : inheritedRoot;

  if (Array.isArray(map.sections)) {
    return map.sections.flatMap(({ map: sectionMap }) => readSources(sectionMap, sourceRoot));
  }
  if (!Array.isArray(map.sources) || map.sources.some((source) => typeof source !== "string" || !source.trim())) {
    throw new Error("Source map has an invalid sources list");
  }
  return map.sources.map((source) => [sourceRoot, source].filter(Boolean).join("/"));
}

function auditPlatform(outputDir, name) {
  const bundleDir = path.join(outputDir, "_expo", "static", "js", name);
  const files = fs.readdirSync(bundleDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
  const bundles = files.filter((file) => /\.(?:js|hbc)$/.test(file));
  const maps = new Set(files.filter((file) => file.endsWith(".map")));
  if (!bundles.length || !maps.size) throw new Error(`[${name}] No bundles or source maps were exported`);

  for (const bundle of bundles) {
    if (!maps.has(`${bundle}.map`)) {
      throw new Error(`[${name}] Source map missing for ${bundle}`);
    }
  }

  const leaks = [];
  let sourceCount = 0;
  for (const file of maps) {
    const mapFile = path.join(bundleDir, file);
    let sources;
    try {
      sources = readSources(JSON.parse(fs.readFileSync(mapFile, "utf8")));
      if (!sources.length) throw new Error("Source map contains no sources");
    } catch (error) {
      throw new Error(`[${name}] Cannot inspect ${file}: ${error.message}`, { cause: error });
    }
    sourceCount += sources.length;
    for (const source of sources) {
      const segments = source.replaceAll("\\", "/").split("/");
      for (const [index, segment] of segments.entries()) {
        const packageName = segments[index + 1];
        if (segment === "node_modules" && targetPackages.has(packageName)) {
          leaks.push({ file: path.relative(outputDir, mapFile), packageName, source });
        }
      }
    }
  }

  console.log(`[Runtime Audit] ${name}: ${bundles.length} bundle(s), ${maps.size} map(s), ${sourceCount} source entries.`);
  return { leaks, counts: { name, bundles: bundles.length, maps: maps.size, sources: sourceCount } };
}

function run() {
  const job = execution();
  const receiptFile = receiptPath(job);
  clearReceipt(receiptFile);
  if ((process.env.AUDIT_PLATFORMS || "all") !== "all") {
    throw new Error("AUDIT_PLATFORMS must be all (web, android, and ios)");
  }
  const mobile = fs.realpathSync(path.join(root, "mobile"));
  const appDir = fs.realpathSync(path.resolve(root, process.env.EXPO_APP_DIR || "mobile"));
  if (appDir !== mobile) {
    throw new Error("Only the mobile app in this checkout can produce a runtime audit receipt");
  }
  const expoCli = path.join(appDir, "node_modules", "expo", "bin", "cli");
  if (!fs.existsSync(expoCli)) throw new Error(`Expo CLI missing in ${appDir}. Install the app dependencies first.`);

  const beforeExport = checkout(job);
  const tempRoot = fs.realpathSync(os.tmpdir());
  const tempDir = fs.mkdtempSync(path.join(tempRoot, "lauda-runtime-audit-"));
  const outputDir = path.join(tempDir, "export");
  let audited;
  try {
    console.log("[Runtime Audit] Exporting web, android, and ios production bundles with source maps.");
    execFileSync(process.execPath, [expoCli, "export", "--platform", "all", "--source-maps", "--clear", "--max-workers", "4", "--output-dir", outputDir], {
      cwd: appDir,
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_ENV: "production",
        EXPO_PUBLIC_APP_ENV: "production",
        EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || "https://api.laudaapp.com/api",
        EXPO_NO_DOTENV: "1",
        EXPO_NO_TELEMETRY: "1",
      },
    });

    audited = platforms.map((name) => auditPlatform(outputDir, name));
    const leaks = audited.flatMap((result) => result.leaks);
    if (leaks.length) {
      for (const leak of leaks) {
        console.error(`[Runtime Audit] ${leak.packageName} | ${leak.file} | ${leak.source}`);
      }
      throw new Error("Blocked package detected in a production runtime bundle");
    }
  } finally {
    if (path.dirname(tempDir) !== tempRoot) throw new Error("Unexpected runtime audit directory");
    fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3 });
  }

  const identity = checkout(job);
  if (identity.commit !== beforeExport.commit || identity.sourceHash !== beforeExport.sourceHash) {
    throw new Error("Checkout changed during the runtime audit");
  }
  const directory = path.dirname(receiptFile);
  fs.mkdirSync(directory, { recursive: true });
  if (!fs.lstatSync(directory).isDirectory()) throw new Error("Invalid runtime audit receipt directory");
  fs.writeFileSync(receiptFile, JSON.stringify({
    schema_version: 1,
    status: "passed",
    timestamp: Date.now(),
    ...identity,
    worktree: root,
    run: job ? { id: job.id, attempt: job.attempt, job: job.job } : null,
    packages: [...targetPackages],
    platforms: audited.map((result) => result.counts),
  }) + "\n", { flag: "wx", mode: 0o600 });
  console.log(`[Runtime Audit] No blocked packages found: ${[...targetPackages].join(", ")}. Single-use receipt issued.`);
}

try {
  run();
} catch (error) {
  console.error(`[Runtime Audit] ${error.message}`);
  process.exitCode = 1;
}
