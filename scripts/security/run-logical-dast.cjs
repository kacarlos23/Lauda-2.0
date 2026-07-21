const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const output = path.resolve(root, process.env.LOGICAL_DAST_OUTPUT || "security-artifacts/dast-logical/results.json");
fs.mkdirSync(path.dirname(output), { recursive: true });

const jest = path.join(root, "node_modules", "jest", "bin", "jest.js");
const result = spawnSync(process.execPath, [
  jest,
  "src/__tests__/integration/privilegedAccess.test.ts",
  "src/__tests__/unit/propertyAuthorization.test.ts",
  "--runInBand", "--json", `--outputFile=${output}`,
], {
  cwd: root,
  env: { ...process.env, NODE_ENV: "test", LOGICAL_DAST_DATA_CLASS: "synthetic" },
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
