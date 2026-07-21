const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const outputRoot = path.resolve(root, process.env.SECURITY_ARTIFACT_DIR || "security-artifacts/dependencies");
const gateEnabled = process.argv.includes("--gate") || process.env.SECURITY_GATE_MODE === "ci";
const npmCli = process.env.npm_execpath;

if (!npmCli) {
  throw new Error("Run this command through npm (npm run security:dependencies) so the npm CLI is version-pinned by the runner.");
}

function audit(project, omitDevelopment) {
  const args = [npmCli, "audit", "--json"];
  if (omitDevelopment) args.push("--omit=dev");
  const result = spawnSync(process.execPath, args, {
    cwd: path.resolve(root, project.directory),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  let payload;
  try {
    payload = JSON.parse(result.stdout || "{}");
  } catch {
    throw new Error(`${project.id} npm audit did not return JSON (exit ${result.status}): ${result.stderr.trim()}`);
  }
  if (payload.error) throw new Error(`${project.id} npm audit failed: ${payload.error.summary || payload.error.code}`);
  return payload;
}

function normalizeFinding(name, finding) {
  const advisories = Array.isArray(finding.via) ? finding.via.filter((item) => typeof item === "object").map((item) => ({
    source: item.source,
    name: item.name,
    title: item.title,
    url: item.url,
    severity: item.severity,
    range: item.range,
  })) : [];
  return {
    package: name,
    severity: finding.severity,
    direct: Boolean(finding.isDirect),
    range: finding.range,
    nodes: [...(finding.nodes || [])].sort(),
    fix_available: finding.fixAvailable,
    advisories,
  };
}

function counts(findings) {
  const result = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: findings.length };
  for (const finding of findings) result[finding.severity] = (result[finding.severity] || 0) + 1;
  return result;
}

function writeReport(project, category, command, findings) {
  const report = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    project: project.id,
    category,
    source_command: command,
    policy: category === "runtime" ? "block high/critical" : "block critical; triage high under tooling SLA",
    counts: counts(findings),
    findings,
  };
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.writeFileSync(path.join(outputRoot, `${project.id}-${category}.json`), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

const projects = [
  { id: "backend", directory: "." },
  { id: "mobile", directory: "mobile" },
];
let blocked = false;

for (const project of projects) {
  const runtimeRaw = audit(project, true);
  const allRaw = audit(project, false);
  const runtimeNames = new Set(Object.keys(runtimeRaw.vulnerabilities || {}));
  const runtimeFindings = Object.entries(runtimeRaw.vulnerabilities || {}).map(([name, value]) => normalizeFinding(name, value)).sort((a, b) => a.package.localeCompare(b.package));
  const toolingFindings = Object.entries(allRaw.vulnerabilities || {}).filter(([name]) => !runtimeNames.has(name)).map(([name, value]) => normalizeFinding(name, value)).sort((a, b) => a.package.localeCompare(b.package));
  const runtimeReport = writeReport(project, "runtime", "npm audit --omit=dev --json", runtimeFindings);
  const toolingReport = writeReport(project, "development-tooling", "npm audit --json minus packages already reachable from runtime", toolingFindings);
  console.log(`${project.id}: runtime=${JSON.stringify(runtimeReport.counts)} development-tooling=${JSON.stringify(toolingReport.counts)}`);
  if (gateEnabled && runtimeFindings.some((item) => ["high", "critical"].includes(item.severity))) blocked = true;
  if (gateEnabled && toolingFindings.some((item) => item.severity === "critical")) blocked = true;
}

if (blocked) {
  console.error("Dependency gate blocked: runtime high/critical or development/tooling critical finding present.");
  process.exitCode = 1;
}
