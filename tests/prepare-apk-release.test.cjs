"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  buildApkReleaseObject,
  buildR2UploadArgs,
  computeCandidateSourceHash,
  computeFileSha256,
  runCli,
  validateApkFile,
  writeCandidateReleaseManifests,
} = require("../scripts/prepare-apk-release.cjs");

function createFakeApk(dir, filename = "lauda-test.apk") {
  const filePath = path.join(dir, filename);
  const content = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from("fake-android-apk-payload-for-tests"),
  ]);
  fs.writeFileSync(filePath, content);
  const expectedSha = crypto.createHash("sha256").update(content).digest("hex");
  return { filePath, expectedSha, expectedSize: content.length };
}

function createFakeCandidatePair(dir) {
  const webDir = path.join(dir, "web");
  const backendDir = path.join(dir, "backend");
  fs.mkdirSync(path.join(webDir, "_expo"), { recursive: true });
  fs.mkdirSync(path.join(backendDir, "dist"), { recursive: true });
  fs.writeFileSync(path.join(webDir, "index.html"), "<html>ok</html>", "utf8");
  fs.writeFileSync(path.join(webDir, "apk-release.json"), '{"available":false}\n', "utf8");
  fs.writeFileSync(path.join(webDir, "_expo", "app.js"), "console.log('web');", "utf8");
  fs.writeFileSync(path.join(backendDir, "server.js"), "console.log('api');", "utf8");
  fs.writeFileSync(path.join(backendDir, "dist", "app.js"), "console.log('dist');", "utf8");
  return { webDir, backendDir };
}

describe("prepare-apk-release.cjs", () => {
  it("valida arquivo APK com assinatura ZIP, calcula SHA-256 e gera manifesto de staging/produção", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lauda-apk-release-"));
    try {
      const { filePath, expectedSha, expectedSize } = createFakeApk(tempDir);
      const outPath = path.join(tempDir, "out", "apk-release.json");

      const validated = validateApkFile(filePath);
      assert.equal(validated.fileSizeBytes, expectedSize);
      assert.equal(computeFileSha256(filePath), expectedSha);

      const { manifest, objectKey, filename } = runCli([
        "--apk",
        filePath,
        "--env",
        "staging",
        "--version",
        "1.2.0",
        "--version-code",
        "7",
        "--notes",
        "Build inicial de testes.",
        "--out",
        outPath,
      ]);

      assert.equal(filename, "lauda-testes-v1.2.0-b7.apk");
      assert.equal(objectKey, "staging/lauda-testes-v1.2.0-b7.apk");
      assert.deepEqual(
        {
          available: manifest.available,
          environment: manifest.environment,
          version: manifest.version,
          versionCode: manifest.versionCode,
          url: manifest.url,
          sha256: manifest.sha256,
          fileSizeBytes: manifest.fileSizeBytes,
          releaseNotes: manifest.releaseNotes,
        },
        {
          available: true,
          environment: "staging",
          version: "1.2.0",
          versionCode: 7,
          url: "https://downloads.laudaapp.com/staging/lauda-testes-v1.2.0-b7.apk",
          sha256: expectedSha,
          fileSizeBytes: expectedSize,
          releaseNotes: "Build inicial de testes.",
        }
      );

      const written = JSON.parse(fs.readFileSync(outPath, "utf8"));
      assert.equal(written.url, manifest.url);
      assert.equal(written.sha256, expectedSha);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("sincroniza release.json com sourceHash idêntico no frontend e backend candidatos", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lauda-apk-sync-"));
    try {
      const { webDir, backendDir } = createFakeCandidatePair(tempDir);
      const { filePath } = createFakeApk(tempDir);

      // Modo --sync-only antes do APK existir
      const firstSync = runCli([
        "--sync-only",
        "--env",
        "staging",
        "--sync-web-dir",
        webDir,
        "--sync-backend-dir",
        backendDir,
      ]);
      const hashBeforeApk = firstSync.synced.sourceHash;
      assert.match(hashBeforeApk, /^[a-f0-9]{64}$/);

      const webReleaseBefore = JSON.parse(fs.readFileSync(path.join(webDir, "release.json"), "utf8"));
      const apiReleaseBefore = JSON.parse(fs.readFileSync(path.join(backendDir, "release.json"), "utf8"));
      assert.equal(webReleaseBefore.sourceHash, apiReleaseBefore.sourceHash);
      assert.equal(webReleaseBefore.apiUrl, "https://testes.laudaapp.com/api");

      // Reexecutar sem alterar arquivos preserva o mesmo sourceHash
      assert.equal(computeCandidateSourceHash(webDir, backendDir), hashBeforeApk);

      // Gravar apk-release.json + sincronizar deve recalcular o sourceHash incluindo o novo apk-release.json
      const withApk = runCli([
        "--apk",
        filePath,
        "--env",
        "staging",
        "--version",
        "1.0.0",
        "--version-code",
        "1",
        "--sync-web-dir",
        webDir,
        "--sync-backend-dir",
        backendDir,
      ]);

      const hashAfterApk = withApk.synced.sourceHash;
      assert.notEqual(hashAfterApk, hashBeforeApk);
      const apkJson = JSON.parse(fs.readFileSync(path.join(webDir, "apk-release.json"), "utf8"));
      assert.equal(apkJson.available, true);

      const webReleaseAfter = JSON.parse(fs.readFileSync(path.join(webDir, "release.json"), "utf8"));
      const apiReleaseAfter = JSON.parse(fs.readFileSync(path.join(backendDir, "release.json"), "utf8"));
      assert.equal(webReleaseAfter.sourceHash, hashAfterApk);
      assert.equal(apiReleaseAfter.sourceHash, hashAfterApk);
      assert.equal(webReleaseAfter.apkVersion, "1.0.0");
      assert.equal(webReleaseAfter.apkVersionCode, 1);

      assert.throws(
        () =>
          writeCandidateReleaseManifests({
            webDir,
            backendDir,
            env: "production",
          }),
        /--commit/
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejeita arquivos sem assinatura ZIP/APK, URLs inseguras, sync incompleto e ambientes inválidos", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lauda-apk-invalid-"));
    try {
      const notApk = path.join(tempDir, "invalid.apk");
      fs.writeFileSync(notApk, "plain-text-not-zip");
      assert.throws(() => validateApkFile(notApk), /assinatura ZIP\/APK válida/);
      assert.throws(() => runCli(["--sync-only", "--env", "staging"]), /--sync-web-dir e --sync-backend-dir/);
      assert.throws(
        () => runCli(["--sync-only", "--env", "staging", "--sync-web-dir", tempDir]),
        /juntos/
      );

      assert.throws(
        () =>
          buildApkReleaseObject({
            env: "production",
            version: "1.0.0",
            versionCode: 1,
            baseUrl: "https://evil.example.com",
            sha256: "a".repeat(64),
            fileSizeBytes: 1024,
          }),
        /Host não autorizado/
      );

      assert.throws(
        () =>
          buildApkReleaseObject({
            env: "dev",
            version: "1.0.0",
            versionCode: 1,
            sha256: "a".repeat(64),
            fileSizeBytes: 1024,
          }),
        /Ambiente inválido/
      );

      assert.throws(
        () =>
          buildApkReleaseObject({
            env: "production",
            version: "1.0.0",
            versionCode: 0,
            sha256: "a".repeat(64),
            fileSizeBytes: 1024,
          }),
        /inteiro positivo/
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("monta argumentos seguros para upload no Cloudflare R2 com headers obrigatórios", () => {
    const args = buildR2UploadArgs({
      bucket: "lauda-downloads",
      objectKey: "production/lauda-v1.0.0-b1.apk",
      apkPath: "/tmp/lauda-v1.0.0-b1.apk",
      downloadFilename: "lauda-v1.0.0-b1.apk",
    });

    assert.deepEqual(args, [
      "r2",
      "object",
      "put",
      "lauda-downloads/production/lauda-v1.0.0-b1.apk",
      "--file",
      "/tmp/lauda-v1.0.0-b1.apk",
      "--content-type",
      "application/vnd.android.package-archive",
      "--content-disposition",
      'attachment; filename="lauda-v1.0.0-b1.apk"',
      "--cache-control",
      "public, max-age=31536000, immutable",
      "--remote",
    ]);
  });
});
