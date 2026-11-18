const assert = require("node:assert/strict");
const test = require("node:test");
const { approvedException, onlyReviewedHighAdvisory } = require("../scripts/security/dependency-audit.cjs");
const { root, validateReceipt } = require("../scripts/security/runtime-audit-receipt.cjs");

const policy = {
  id: "GHSA-fc5q-39xc-vjpf",
  status: "approved",
  classification: "accepted_risk",
  project: "mobile",
  package: "picomatch",
  approved_by: "Security owner",
  versions: ["4.0.7"],
  created_at: "2026-11-18",
  expires_at: "2026-12-18",
};
const node = "node_modules/picomatch";
const target = {
  name: "picomatch",
  dependency: "picomatch",
  severity: "high",
  url: "https://github.com/advisories/GHSA-fc5q-39xc-vjpf",
};
const locked = { [node]: { version: "4.0.7" } };

function graph() {
  return {
    expo: { severity: "high", via: ["metro", "postcss"] },
    metro: { severity: "high", via: ["expo", "picomatch"] },
    picomatch: { severity: "high", via: [target], nodes: [node] },
    postcss: { severity: "moderate", via: [{ severity: "moderate" }] },
  };
}

test("accepts the exception through the end of its expiry day in UTC", () => {
  assert.equal(approvedException([policy], new Date("2026-12-18T23:59:59.999Z")), policy);
  assert.throws(() => approvedException([policy], new Date("2026-12-19T00:00:00Z")), /expired on 2026-12-18/);
  assert.equal(approvedException([{ ...policy, status: "pending" }], new Date("2026-11-18")), null);
  assert.throws(() => approvedException([policy, policy], new Date("2026-11-18")), /Duplicate exception/);
});

test("recognizes the sole blocking advisory through cycles and independent moderate findings", () => {
  assert.equal(onlyReviewedHighAdvisory("expo", graph(), policy, locked), true);
  assert.equal(onlyReviewedHighAdvisory("picomatch", graph(), policy, locked), true);
});

test("keeps other advisories blocking even inside a finding that also reaches picomatch", () => {
  for (const severity of ["high", "critical"]) {
    const vulnerabilities = graph();
    vulnerabilities.postcss = { severity, via: [{ ...target, severity, url: "https://github.com/advisories/GHSA-xxxx-yyyy-zzzz" }] };
    assert.equal(onlyReviewedHighAdvisory("expo", vulnerabilities, policy, locked), false);
    assert.equal(onlyReviewedHighAdvisory("postcss", vulnerabilities, policy, locked), false);
  }
  const vulnerabilities = graph();
  vulnerabilities.picomatch.via = [target, { ...target, url: "https://github.com/advisories/GHSA-xxxx-yyyy-zzzz" }];
  assert.equal(onlyReviewedHighAdvisory("expo", vulnerabilities, policy, locked), false);
});

test("refuses unreviewed versions, missing edges, and critical findings", () => {
  assert.equal(onlyReviewedHighAdvisory("expo", graph(), policy, { [node]: { version: "4.0.8" } }), false);
  const vulnerabilities = graph();
  delete vulnerabilities.metro;
  assert.equal(onlyReviewedHighAdvisory("expo", vulnerabilities, policy, locked), false);
  vulnerabilities.picomatch.severity = "critical";
  assert.equal(onlyReviewedHighAdvisory("picomatch", vulnerabilities, policy, locked), false);
});

test("accepts fresh coverage only for this checkout and successful CI job", () => {
  const now = Date.parse("2026-11-18T12:00:00Z");
  const identity = { commit: "head", sourceHash: "tree" };
  const run = { id: "123", attempt: "1", job: "dependency-scanning" };
  const context = { now, identity, run, stepOutcome: "success" };
  const receipt = {
    schema_version: 1,
    status: "passed",
    timestamp: now - 1000,
    ...identity,
    worktree: root,
    run,
    packages: ["picomatch"],
    platforms: ["web", "android", "ios"].map((name) => ({ name, bundles: 1, maps: 1, sources: 1 })),
  };
  assert.equal(validateReceipt(receipt, context), receipt);
  for (const invalid of [
    { status: "failed" },
    { timestamp: now - 15 * 60 * 1000 - 1 },
    { timestamp: now + 1 },
    { packages: [] },
    { sourceHash: "another checkout" },
    { platforms: receipt.platforms.slice(0, 2) },
    { platforms: [...receipt.platforms.slice(0, 2), { name: "ios", bundles: 0, maps: 0, sources: 0 }] },
    { run: { ...run, id: "456" } },
    { run: { ...run, attempt: "2" } },
    { run: { ...run, job: "another-job" } },
  ]) {
    assert.throws(() => validateReceipt({ ...receipt, ...invalid }, context));
  }
  assert.throws(() => validateReceipt(receipt, { ...context, stepOutcome: "failure" }), /successful CI job/);
});
