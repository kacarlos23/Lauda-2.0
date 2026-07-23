import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { basePrismaAllowlist } from "../../security/basePrismaAllowlist";

function matchingProductionFiles(pattern: RegExp): string[] {
  const matches: string[] = [];

  function visit(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);
      const projectPath = relative(process.cwd(), absolutePath).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        if (projectPath === "src/__tests__") continue;
        visit(absolutePath);
      } else if (entry.isFile() && entry.name.endsWith(".ts") && pattern.test(readFileSync(absolutePath, "utf8"))) {
        matches.push(projectPath);
      }
    }
  }

  visit(join(process.cwd(), "src"));
  visit(join(process.cwd(), "scripts"));
  return matches.sort();
}

describe("basePrisma architecture allowlist", () => {
  it("fails when production code introduces a raw Prisma bypass outside the reviewed allowlist", () => {
    const actual = matchingProductionFiles(/\bbasePrisma\b/);
    const expected = basePrismaAllowlist.map((entry) => entry.path).sort();
    expect(actual).toEqual(expected);
    for (const entry of basePrismaAllowlist) {
      expect(entry.owner).not.toMatch(/TBD/i);
      expect(entry.context.length).toBeGreaterThan(20);
    }
  });

  it("keeps direct PrismaClient construction limited to the central config", () => {
    expect(matchingProductionFiles(/new PrismaClient/)).toEqual(["src/config/prisma.ts"]);
  });
});
