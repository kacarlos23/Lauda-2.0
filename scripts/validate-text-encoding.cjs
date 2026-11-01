"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const textFile = /\.(?:[cm]?[jt]sx?|json|md|html|ps1|ya?ml|txt|css|sql|prisma|svg|webmanifest|xml|bat|vbs)$/i;
const textNames = new Set([".editorconfig", ".gitattributes", ".gitignore", "Dockerfile"]);
// UTF-8 bytes decoded as Latin-1/Windows-1252, or irreversibly replaced characters.
const corruption = /\uFFFD|[\u0080-\u009f]|[\u00c2\u00c3][\u0080-\u00bf\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2010-\u203a\u20ac\u2122]|\u00e2[\u0080-\u00bf\u20ac][\u0080-\u00bf\u2010-\u203a\u20ac\u2122]|\u00f0\u0178/;

function validateText(buffer, name) {
  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return [`${name}: invalid UTF-8 bytes`];
  }
  return source.split(/\r?\n/).flatMap((line, index) =>
    corruption.test(line) ? [`${name}:${index + 1}: corrupted text`] : []);
}

function validateProject(root = projectRoot) {
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: root, encoding: "utf8",
  }).split("\0").filter(Boolean);
  const errors = [];
  let checked = 0;
  for (const file of new Set(files)) {
    if (!textFile.test(file) && !textNames.has(path.basename(file)) && !file.startsWith(".husky/")) continue;
    const absolute = path.join(root, file);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
    checked++;
    errors.push(...validateText(fs.readFileSync(absolute), file));
  }
  return { checked, errors };
}

if (require.main === module) {
  const { checked, errors } = validateProject();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`UTF-8 validation passed (${checked} source files).`);
  }
}

module.exports = { validateText, validateProject };
