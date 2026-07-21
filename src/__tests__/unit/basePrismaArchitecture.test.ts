import { execFileSync } from "node:child_process";
import { basePrismaAllowlist } from "../../security/basePrismaAllowlist";

describe("basePrisma architecture allowlist", () => {
  it("fails when production code introduces a raw Prisma bypass outside the reviewed allowlist", () => {
    const output = execFileSync("rg", [
      "-l",
      "--glob", "*.ts",
      "--glob", "!src/__tests__/**",
      "\\bbasePrisma\\b",
      "src",
      "scripts",
    ], { encoding: "utf8" });
    const actual = output.trim().split(/\r?\n/).filter(Boolean).map((path) => path.replace(/\\/g, "/")).sort();
    const expected = basePrismaAllowlist.map((entry) => entry.path).sort();
    expect(actual).toEqual(expected);
    for (const entry of basePrismaAllowlist) {
      expect(entry.owner).not.toMatch(/TBD/i);
      expect(entry.context.length).toBeGreaterThan(20);
    }
  });

  it("keeps direct PrismaClient construction limited to the central config", () => {
    const output = execFileSync("rg", [
      "-l", "--glob", "*.ts", "--glob", "!src/__tests__/**", "new PrismaClient", "src", "scripts",
    ], { encoding: "utf8" }).trim().replace(/\\/g, "/");
    expect(output).toBe("src/config/prisma.ts");
  });
});
