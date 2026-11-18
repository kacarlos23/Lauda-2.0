const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { root, execution, consumeReceipt } = require("./runtime-audit-receipt.cjs");

const outputRoot = path.resolve(root, process.env.SECURITY_ARTIFACT_DIR || "security-artifacts/dependencies");
const npmCli = process.env.npm_execpath;
const advisoryId = "GHSA-fc5q-39xc-vjpf";
const advisoryUrl = `https://github.com/advisories/${advisoryId}`;
const lowerSeverities = new Set(["info", "low", "moderate"]);

function audit(project, omitDevelopment) {
  const args = [npmCli, "audit", "--json"];
  if (omitDevelopment) args.push("--omit=dev");
  const result = spawnSync(process.execPath, args, {
    cwd: path.resolve(root, project.directory),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  let payload;
  try {
    payload = JSON.parse(result.stdout);
  } catch {
    throw new Error(`${project.id} npm audit did not return JSON (exit ${result.status}): ${result.stderr.trim()}`);
  }
  if (payload?.error) throw new Error(`${project.id} npm audit failed: ${payload.error.summary || payload.error.code}`);
  if (payload?.auditReportVersion !== 2 || !payload.vulnerabilities ||
      typeof payload.vulnerabilities !== "object" || Array.isArray(payload.vulnerabilities) ||
      ![0, 1].includes(result.status)) {
    throw new Error(`${project.id} npm audit did not return a supported vulnerability report (exit ${result.status})`);
  }
  return payload;
}

function approvedException(records, now) {
  if (!Array.isArray(records)) throw new Error("Security exception policy has no exceptions list");
  const matches = records.filter((record) => record?.id === advisoryId);
  if (matches.length > 1) throw new Error(`Duplicate exception for ${advisoryId}`);
  const [record] = matches;
  if (record?.status !== "approved") return null;
  if (record.classification !== "accepted_risk" || record.project !== "mobile" ||
      record.package !== "picomatch" || typeof record.approved_by !== "string" ||
      !record.approved_by.trim() || !Array.isArray(record.versions) || !record.versions.length ||
      !record.versions.every((version) => typeof version === "string" && /^\d+\.\d+\.\d+$/.test(version))) {
    throw new Error(`Invalid scope or approval for ${advisoryId}`);
  }
  for (const date of [record.created_at, record.expires_at]) {
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      throw new Error(`Invalid date for ${advisoryId}`);
    }
  }
  const today = now.toISOString().slice(0, 10);
  if (today > record.expires_at) throw new Error(`${advisoryId} exception expired on ${record.expires_at} (UTC)`);
  if (today < record.created_at) throw new Error(`${advisoryId} exception is not yet effective`);
  return record;
}

function onlyReviewedHighAdvisory(name, vulnerabilities, record, lockedPackages) {
  if (vulnerabilities[name]?.severity !== "high") return false;
  const pending = [name];
  const visited = new Set();
  let foundReviewedAdvisory = false;

  // An npm finding can aggregate several advisories and its dependency graph can cycle.
  while (pending.length) {
    const current = pending.pop();
    if (visited.has(current)) continue;
    visited.add(current);
    if (!Object.hasOwn(vulnerabilities, current)) return false;
    const { via, nodes, severity } = vulnerabilities[current];
    if (severity !== "high" && !lowerSeverities.has(severity)) return false;
    if (!Array.isArray(via) || via.length === 0) return false;
    for (const cause of via) {
      if (typeof cause === "string") {
        pending.push(cause);
      } else if (current === "picomatch" && cause?.name === "picomatch" &&
          cause.dependency === "picomatch" && cause.severity === "high" && cause.url === advisoryUrl) {
        if (!Array.isArray(nodes) || !nodes.length || !nodes.every((node) =>
          typeof node === "string" && /(?:^|\/)node_modules\/picomatch$/.test(node) &&
          record.versions.includes(lockedPackages[node]?.version))) return false;
        foundReviewedAdvisory = true;
      } else if (!lowerSeverities.has(cause?.severity)) {
        return false;
      }
    }
  }
  return foundReviewedAdvisory;
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

function run() {
  if (!npmCli) throw new Error("Run this command through npm (npm run security:dependencies) to use the runner's npm CLI.");
  const gateEnabled = process.argv.includes("--gate") || process.env.SECURITY_GATE_MODE === "ci";
  const now = new Date();
  let record;
  let receipt;
  let blocked = false;
  if (gateEnabled) {
    try {
      const YAML = require(path.join(root, "mobile", "node_modules", "yaml"));
      const policy = YAML.parse(fs.readFileSync(path.join(root, ".security", "exceptions.yml"), "utf8"), { maxAliasCount: 0 });
      record = approvedException(policy?.exceptions, now);
    } catch (error) {
      console.error(`Dependency exception policy rejected: ${error.message}`);
      blocked = true;
    }
    if (record) {
      try {
        receipt = consumeReceipt(execution(), now.getTime());
      } catch (error) {
        console.error(`${advisoryId} exception unavailable: ${error.message}`);
        blocked = true;
      }
    }
  }
  const projects = [
    { id: "backend", directory: "." },
    { id: "mobile", directory: "mobile" },
  ];
  for (const project of projects) {
    const runtime = audit(project, true).vulnerabilities;
    const all = audit(project, false).vulnerabilities;
    const runtimeFindings = Object.entries(runtime).map(([name, value]) => normalizeFinding(name, value)).sort((a, b) => a.package.localeCompare(b.package));
    const toolingFindings = Object.entries(all)
      .filter(([name, value]) => !Object.hasOwn(runtime, name) || (value.severity === "critical" && runtime[name].severity !== "critical"))
      .map(([name, value]) => normalizeFinding(name, value)).sort((a, b) => a.package.localeCompare(b.package));

    if (project.id === "mobile" && record && receipt) {
      const { packages } = JSON.parse(fs.readFileSync(path.join(root, "mobile", "package-lock.json"), "utf8"));
      const excepted = runtimeFindings.filter((item) => onlyReviewedHighAdvisory(item.package, runtime, record, packages));
      const timestamp = new Date(receipt.timestamp).toISOString();
      const coverage = receipt.platforms.map(({ name, maps }) => `${name}=${maps}`).join(", ");
      if (excepted.length) {
        console.log(`${advisoryId}: approved through ${record.expires_at} (inclusive UTC). Runtime receipt verified for ${receipt.commit} at ${timestamp}; source maps: ${coverage}.`);
      }
      for (const item of excepted) {
        item.exception = { id: advisoryId, expires_at: record.expires_at, runtime_audit: { commit: receipt.commit, timestamp, platforms: receipt.platforms } };
        console.log(`  mobile ${item.package} (high): excepted by ${advisoryId}`);
      }
    }

    const runtimeReport = writeReport(project, "runtime", "npm audit --omit=dev --json", runtimeFindings);
    const toolingReport = writeReport(project, "development-tooling", "npm audit --json minus packages already reachable at the same blocking severity from runtime", toolingFindings);
    console.log(`${project.id}: runtime=${JSON.stringify(runtimeReport.counts)} development-tooling=${JSON.stringify(toolingReport.counts)}`);
    if (gateEnabled && runtimeFindings.some((item) => item.severity === "critical" ||
        (item.severity === "high" && !item.exception))) blocked = true;
    if (gateEnabled && toolingFindings.some((item) => item.severity === "critical")) blocked = true;
  }

  if (blocked) {
    console.error("Dependency gate blocked: invalid exception policy, runtime high/critical, or development/tooling critical finding present.");
    process.exitCode = 1;
  }
}

if (require.main === module) run();
module.exports = { approvedException, onlyReviewedHighAdvisory };
