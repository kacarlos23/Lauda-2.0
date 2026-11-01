"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateText, validateProject } = require("../scripts/validate-text-encoding.cjs");

test("accepts Portuguese, Japanese, music symbols and emoji in UTF-8", () => {
  const text = "Não • músicas • MANHÃ • execução • 日本語 • ♯ ♭ 🎵";
  assert.deepEqual(validateText(Buffer.from(text), "valid.ts"), []);
});

test("rejects invalid UTF-8 bytes instead of silently replacing them", () => {
  assert.deepEqual(validateText(Buffer.from([0x4e, 0xe3, 0x6f]), "invalid.ts"), ["invalid.ts: invalid UTF-8 bytes"]);
});

test("rejects replacement characters, C1 controls and repeated misdecoding", () => {
  for (const broken of ["N\ufffdo", "m\u00c3\u00basicas", "execu\u00c3\u00a7\u00c3\u00a3o", "\u00c3\u0192\u00c2\u00a3", "\u00e2\u20ac\u00a2", "\u00c2\u00a0", "\u00f0\u0178\u017d\u00b5", "\u0081"]) {
    assert.deepEqual(validateText(Buffer.from(`ok\n${broken}`), "broken.ts"), ["broken.ts:2: corrupted text"]);
  }
});

test("all project source text is valid UTF-8 without corruption", () => {
  const result = validateProject();
  assert.ok(result.checked > 0);
  assert.deepEqual(result.errors, []);
});
