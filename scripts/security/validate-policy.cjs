const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const lines = fs.readFileSync(path.join(root, ".security", "exceptions.yml"), "utf8").split(/\r?\n/);
const required = [
  "id", "finding", "classification", "justification", "owner", "approved_by",
  "created_at", "expires_at", "review_condition", "compensating_controls",
];
const records = [];
let current = null;

for (const line of lines) {
  const start = line.match(/^  - id:\s*(.+?)\s*$/);
  if (start) {
    if (current) records.push(current);
    current = { id: start[1].replace(/^['"]|['"]$/g, "") };
    continue;
  }
  if (!current) continue;
  const field = line.match(/^    ([a-z_]+):(?:\s*(.*?))?\s*$/);
  if (field) current[field[1]] = (field[2] || "").replace(/^['"]|['"]$/g, "");
}
if (current) records.push(current);
if (!records.length) throw new Error("No exception records found");

const asOf = new Date(process.env.POLICY_AS_OF || new Date().toISOString().slice(0, 10));
for (const record of records) {
  const missing = required.filter((field) => !(field in record) || (field !== "compensating_controls" && !record[field]));
  if (missing.length) throw new Error(`${record.id || "unknown"} is missing: ${missing.join(", ")}`);
  const created = new Date(`${record.created_at}T00:00:00Z`);
  const expires = new Date(`${record.expires_at}T23:59:59Z`);
  if (!Number.isFinite(created.getTime()) || !Number.isFinite(expires.getTime())) throw new Error(`${record.id} has invalid dates`);
  if (expires <= asOf) throw new Error(`${record.id} expired on ${record.expires_at}`);
  if ((expires - created) / 86_400_000 > 91) throw new Error(`${record.id} exceeds the 90-day exception window`);
}

console.log(`Security exception policy valid: ${records.length} records, none expired as of ${asOf.toISOString().slice(0, 10)}`);
