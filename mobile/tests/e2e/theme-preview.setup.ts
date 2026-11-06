import { execFileSync } from "node:child_process";
import path from "node:path";

// Refresh the isolated fixture once per run. Reusing an expired storage state across
// browser contexts would rotate the same refresh token and revoke the test session.
export default function setup() {
  execFileSync(process.execPath, [path.resolve("../scripts/prepare-theme-preview.cjs")], {
    cwd: path.resolve(".."),
    stdio: "inherit",
  });
}
