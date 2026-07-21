const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync, execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const npmCli = process.env.npm_execpath;
const tool = "@cyclonedx/cyclonedx-npm@4.2.1";
if (!npmCli) throw new Error("Run through npm (npm run security:sbom or npm run security:sbom:verify).");

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function releaseId() {
  const supplied = process.env.RELEASE_ID;
  const fallback = execFileSync("git", ["describe", "--tags", "--always", "--dirty"], { cwd: root, encoding: "utf8" }).trim();
  return (supplied || fallback).replace(/[^A-Za-z0-9._-]/g, "_");
}

function generate(projectManifest, outputFile) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  const result = spawnSync(process.execPath, [
    npmCli, "exec", "--yes", `--package=${tool}`, "--", "cyclonedx-npm",
    "--package-lock-only", "--ignore-npm-errors", "--output-reproducible",
    "--spec-version", "1.6", "--output-format", "JSON", "--output-file", outputFile,
    projectManifest,
  ], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`SBOM generation failed for ${projectManifest}: ${result.stderr || result.stdout}`);
  JSON.parse(fs.readFileSync(outputFile, "utf8"));
}

function generateSet(directory) {
  const outputs = [
    { name: "backend.cdx.json", manifest: "package.json", lockfile: "package-lock.json" },
    { name: "mobile.cdx.json", manifest: "mobile/package.json", lockfile: "mobile/package-lock.json" },
  ];
  for (const item of outputs) generate(item.manifest, path.join(directory, item.name));
  return outputs.map((item) => ({
    artifact: item.name,
    sha256: sha256(path.join(directory, item.name)),
    lockfile: item.lockfile,
    lockfile_sha256: sha256(path.join(root, item.lockfile)),
  }));
}

if (process.argv.includes("--verify")) {
  const first = fs.mkdtempSync(path.join(os.tmpdir(), "lauda-sbom-a-"));
  const second = fs.mkdtempSync(path.join(os.tmpdir(), "lauda-sbom-b-"));
  try {
    const a = generateSet(first);
    const b = generateSet(second);
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`SBOM is not reproducible: ${JSON.stringify({ a, b })}`);
    console.log(`SBOM reproducibility verified: ${a.map((item) => `${item.artifact}=${item.sha256}`).join(" ")}`);
  } finally {
    fs.rmSync(first, { recursive: true, force: true });
    fs.rmSync(second, { recursive: true, force: true });
  }
} else {
  const id = releaseId();
  const directory = path.resolve(root, process.env.SBOM_OUTPUT_DIR || `security-artifacts/sbom/${id}`);
  const artifacts = generateSet(directory);
  const manifest = {
    schema_version: 1,
    release: id,
    generator: tool,
    reproducible: true,
    artifacts,
  };
  fs.writeFileSync(path.join(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Generated release SBOM set in ${directory}`);
}
