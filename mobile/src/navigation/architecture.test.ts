import fs from "node:fs";
import path from "node:path";

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });
}

const files = [...sourceFiles(path.resolve("app")), ...sourceFiles(path.resolve("src"))]
  .filter((file) => !/(\.test\.|__tests__|[\\/]tests[\\/])/.test(file));

function violations(pattern: RegExp, excluded: RegExp[] = []) {
  return files.flatMap((file) => {
    if (excluded.some((rule) => rule.test(file))) return [];
    const source = fs.readFileSync(file, "utf8");
    return pattern.test(source) ? [path.relative(process.cwd(), file)] : [];
  });
}

describe("gates arquiteturais de navegação e design", () => {
  it("proíbe as never e destinos literais em chamadas do router", () => {
    expect(violations(/\bas\s+never\b/)).toEqual([]);
    expect(violations(/\brouter\.(?:push|replace)\(\s*["'`]/)).toEqual([]);
  });

  it("proíbe cores de interface fora do tema e da paleta de domínio", () => {
    const exceptions = [
      /[\\/]src[\\/]theme\.ts$/,
      /[\\/]src[\\/]tokens[\\/]/,
      /[\\/]src[\\/]constants[\\/]instrumentCatalog\.ts$/,
    ];
    expect(violations(/["'`]#[0-9a-f]{3,8}\b/i, exceptions)).toEqual([]);
    expect(violations(/\brgba?\(\s*\d/i, exceptions)).toEqual([]);
  });

  it("proíbe tipografia e tamanhos literais de ícone fora do tema", () => {
    const theme = [/[\\/]src[\\/]theme\.ts$/, /[\\/]src[\\/]tokens[\\/]/];
    expect(violations(/\bfontSize:\s*\d/, theme)).toEqual([]);
    expect(violations(/\blineHeight:\s*\d/, theme)).toEqual([]);
    expect(violations(/\bfontWeight:\s*(?:["']?\d{3})/, theme)).toEqual([]);
    expect(violations(/\bfontFamily:\s*(?:["'`]|Platform\.select)/, theme)).toEqual([]);
    expect(violations(/\bsize=\{\s*\d+/)).toEqual([]);
  });
});
