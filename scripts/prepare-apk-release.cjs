"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ALLOWED_ENVIRONMENTS = new Set(["staging", "production"]);
const ALLOWED_APK_BASE_HOSTS = new Set([
  "downloads.laudaapp.com",
  "laudaapp.com",
  "testes.laudaapp.com",
  "localhost",
  "127.0.0.1",
  "::1",
]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_FILENAME_PATTERN = /^[a-zA-Z0-9._-]+\.apk$/;
const SAFE_BUCKET_PATTERN = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const MAX_ANDROID_VERSION_CODE = 2_147_483_647;
const ZIP_LOCAL_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

function apiUrlForEnvironment(env) {
  return env === "staging" ? "https://testes.laudaapp.com/api" : "https://api.laudaapp.com/api";
}

function validateApkFile(apkPath) {
  const rawPath = String(apkPath || "").trim();
  const resolved = path.resolve(rawPath);
  if (!rawPath) {
    throw new Error(`Arquivo APK não encontrado: ${resolved}`);
  }

  let fd;
  try {
    fd = fs.openSync(resolved, "r");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new Error(`Arquivo APK não encontrado: ${resolved}`);
    }
    if (error && error.code === "EISDIR") {
      throw new Error(`O caminho informado não é um arquivo regular: ${resolved}`);
    }
    throw error;
  }

  const header = Buffer.alloc(4);
  let stat;
  try {
    stat = fs.fstatSync(fd);
    if (!stat.isFile()) {
      throw new Error(`O caminho informado não é um arquivo regular: ${resolved}`);
    }
    if (stat.size < 4) {
      throw new Error(`Arquivo APK inválido ou vazio: ${resolved}`);
    }
    fs.readSync(fd, header, 0, 4, 0);
  } finally {
    fs.closeSync(fd);
  }

  if (!header.equals(ZIP_LOCAL_HEADER)) {
    throw new Error(`O arquivo não possui assinatura ZIP/APK válida: ${resolved}`);
  }

  return { resolvedPath: resolved, fileSizeBytes: stat.size };
}

function computeFileSha256(filePath) {
  const hash = crypto.createHash("sha256");
  const buffer = fs.readFileSync(filePath);
  hash.update(buffer);
  return hash.digest("hex");
}

function walkTreeDeterministically(rootDir, currentDir = rootDir, entries = []) {
  if (!fs.existsSync(currentDir)) {
    throw new Error(`Diretório não encontrado: ${currentDir}`);
  }
  if (fs.lstatSync(currentDir).isSymbolicLink()) {
    throw new Error(`Links simbólicos não são permitidos em artefatos de release: ${currentDir}`);
  }
  const names = fs.readdirSync(currentDir).sort();
  for (const name of names) {
    const fullPath = path.join(currentDir, name);
    const stat = fs.lstatSync(fullPath);
    if (stat.isSymbolicLink()) {
      throw new Error(`Links simbólicos não são permitidos em artefatos de release: ${fullPath}`);
    }
    if (stat.isDirectory()) {
      walkTreeDeterministically(rootDir, fullPath, entries);
    } else if (stat.isFile()) {
      const relative = path.relative(rootDir, fullPath).replace(/\\/g, "/");
      entries.push({ fullPath, relative, size: stat.size });
    } else {
      throw new Error(`Tipo de arquivo inesperado em artefato de release: ${fullPath}`);
    }
  }
  return entries;
}

function computeCandidateSourceHash(webDir, backendDir) {
  const resolvedWeb = path.resolve(String(webDir || ""));
  const resolvedBackend = path.resolve(String(backendDir || ""));
  const hash = crypto.createHash("sha256");

  for (const [scope, directory] of [
    ["web", resolvedWeb],
    ["backend", resolvedBackend],
  ]) {
    const entries = walkTreeDeterministically(directory);
    for (const entry of entries) {
      if (entry.relative === "release.json") continue;
      hash.update(JSON.stringify([`${scope}/${entry.relative}`, entry.size]));
      hash.update(fs.readFileSync(entry.fullPath));
    }
  }

  return hash.digest("hex");
}

function writeCandidateReleaseManifests({
  webDir,
  backendDir,
  env,
  feature = "apk-download",
  apkVersion,
  apkVersionCode,
  commit,
}) {
  if (!ALLOWED_ENVIRONMENTS.has(env)) {
    throw new Error(`Ambiente inválido (${env}). Use "staging" ou "production".`);
  }

  const resolvedWeb = path.resolve(String(webDir || ""));
  const resolvedBackend = path.resolve(String(backendDir || ""));
  if (!fs.existsSync(path.join(resolvedWeb, "index.html"))) {
    throw new Error(`Frontend candidato inválido (index.html ausente): ${resolvedWeb}`);
  }
  if (!fs.existsSync(path.join(resolvedBackend, "server.js"))) {
    throw new Error(`Backend candidato inválido (server.js ausente): ${resolvedBackend}`);
  }
  if (env === "production" && !/^[a-f0-9]{40}$/.test(String(commit || ""))) {
    throw new Error("Release de produção exige --commit de 40 caracteres hexadecimais.");
  }

  const sourceHash = computeCandidateSourceHash(resolvedWeb, resolvedBackend);
  const apiUrl = apiUrlForEnvironment(env);
  const builtAt = new Date().toISOString();

  const shared = {
    environment: env,
    apiUrl,
    feature,
    sourceHash,
    builtAt,
    ...(apkVersion ? { apkVersion } : {}),
    ...(apkVersionCode !== undefined ? { apkVersionCode } : {}),
    ...(commit ? { commit } : {}),
  };

  const webManifest = {
    ...shared,
    ...(commit ? { backendCommit: commit } : {}),
  };
  const backendManifest = { ...shared };

  fs.writeFileSync(path.join(resolvedWeb, "release.json"), JSON.stringify(webManifest, null, 2) + "\n", "utf8");
  fs.writeFileSync(path.join(resolvedBackend, "release.json"), JSON.stringify(backendManifest, null, 2) + "\n", "utf8");

  return { webManifest, backendManifest, sourceHash };
}

function validateBaseUrl(rawBaseUrl) {
  const trimmed = String(rawBaseUrl || "").trim();
  if (!trimmed) {
    throw new Error("--base-url é obrigatório.");
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`URL base inválida: ${trimmed}`);
  }
  if (parsed.username || parsed.password) {
    throw new Error("A URL base não pode conter credenciais.");
  }
  const hostname = parsed.hostname.toLowerCase();
  const isLoopback = LOOPBACK_HOSTS.has(hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLoopback)) {
    throw new Error("A URL base precisa usar HTTPS (exceto loopback local).");
  }
  if (!ALLOWED_APK_BASE_HOSTS.has(hostname)) {
    throw new Error(`Host não autorizado para distribuição do APK: ${hostname}`);
  }
  return parsed;
}

function defaultApkFilename({ env, version, versionCode }) {
  const prefix = env === "staging" ? "lauda-testes" : "lauda";
  const safeVersion = String(version).trim().replace(/[^a-zA-Z0-9._-]/g, "-");
  return `${prefix}-v${safeVersion}-b${versionCode}.apk`;
}

function buildApkReleaseObject({
  env,
  version,
  versionCode,
  baseUrl = "https://downloads.laudaapp.com",
  apkFilename,
  sha256,
  fileSizeBytes,
  releaseNotes,
  publishedAt = new Date().toISOString(),
}) {
  if (!ALLOWED_ENVIRONMENTS.has(env)) {
    throw new Error(`Ambiente inválido (${env}). Use "staging" ou "production".`);
  }

  const normalizedVersion = typeof version === "string" ? version.trim() : "";
  if (!normalizedVersion || normalizedVersion.length > 64) {
    throw new Error("--version é obrigatório (até 64 caracteres).");
  }

  if (
    typeof versionCode !== "number" ||
    !Number.isInteger(versionCode) ||
    versionCode <= 0 ||
    versionCode > MAX_ANDROID_VERSION_CODE
  ) {
    throw new Error("--version-code deve ser um inteiro positivo.");
  }

  if (typeof sha256 !== "string" || !SHA256_HEX_PATTERN.test(sha256.trim().toLowerCase())) {
    throw new Error("SHA-256 inválido para o APK.");
  }

  if (typeof fileSizeBytes !== "number" || !Number.isInteger(fileSizeBytes) || fileSizeBytes <= 0) {
    throw new Error("fileSizeBytes deve ser um inteiro positivo.");
  }

  const parsedBase = validateBaseUrl(baseUrl);
  const filename = apkFilename || defaultApkFilename({ env, version: normalizedVersion, versionCode });
  if (!SAFE_FILENAME_PATTERN.test(filename)) {
    throw new Error(`Nome de arquivo APK inválido: ${filename}`);
  }

  const basePath = parsedBase.pathname.replace(/\/+$/, "");
  const objectKey = `${env}/${filename}`;
  const downloadUrl = `${parsedBase.origin}${basePath}/${objectKey}`;

  if (typeof publishedAt !== "string" || Number.isNaN(Date.parse(publishedAt))) {
    throw new Error("publishedAt deve ser uma data ISO-8601 válida.");
  }

  const notes = typeof releaseNotes === "string" && releaseNotes.trim()
    ? releaseNotes.trim().slice(0, 240)
    : undefined;

  return {
    manifest: {
      available: true,
      environment: env,
      version: normalizedVersion,
      versionCode,
      url: downloadUrl,
      sha256: sha256.trim().toLowerCase(),
      fileSizeBytes,
      publishedAt,
      ...(notes ? { releaseNotes: notes } : {}),
    },
    objectKey,
    filename,
  };
}

function buildR2UploadArgs({ bucket, objectKey, apkPath, downloadFilename }) {
  if (typeof bucket !== "string" || !SAFE_BUCKET_PATTERN.test(bucket)) {
    throw new Error(`Nome de bucket R2 inválido: ${bucket}`);
  }
  if (!objectKey || objectKey.includes("..") || objectKey.startsWith("/")) {
    throw new Error(`Chave de objeto R2 inválida: ${objectKey}`);
  }
  if (!SAFE_FILENAME_PATTERN.test(downloadFilename)) {
    throw new Error(`Nome de arquivo de download inválido: ${downloadFilename}`);
  }

  return [
    "r2",
    "object",
    "put",
    `${bucket}/${objectKey}`,
    "--file",
    apkPath,
    "--content-type",
    "application/vnd.android.package-archive",
    "--content-disposition",
    `attachment; filename="${downloadFilename}"`,
    "--cache-control",
    "public, max-age=31536000, immutable",
    "--remote",
  ];
}

function resolveWranglerEntrypoint() {
  try {
    return require.resolve("wrangler/bin/wrangler.js");
  } catch {
    if (process.platform === "win32" && process.env.APPDATA) {
      const globalWin = path.join(process.env.APPDATA, "npm", "node_modules", "wrangler", "bin", "wrangler.js");
      if (fs.existsSync(globalWin)) return globalWin;
    }
    return null;
  }
}

function executeWranglerUpload(args) {
  const wranglerCwd = path.join(os.tmpdir(), "lauda-wrangler-work");
  fs.mkdirSync(wranglerCwd, { recursive: true });
  const entrypoint = resolveWranglerEntrypoint();
  if (entrypoint) {
    execFileSync(process.execPath, [entrypoint, ...args], {
      cwd: wranglerCwd,
      stdio: "inherit",
      windowsHide: true,
    });
    return;
  }
  if (process.platform !== "win32") {
    execFileSync("wrangler", args, { cwd: wranglerCwd, stdio: "inherit" });
    return;
  }
  throw new Error(
    "Wrangler CLI não encontrado para upload automático no R2. Instale com `npm install -g wrangler` ou envie o APK manualmente com os metadados exibidos."
  );
}

function parseCliArgs(argv) {
  const options = {
    apk: null,
    env: null,
    version: null,
    versionCode: null,
    baseUrl: "https://downloads.laudaapp.com",
    filename: null,
    notes: null,
    out: null,
    uploadR2: null,
    syncOnly: false,
    syncWebDir: null,
    syncBackendDir: null,
    feature: "apk-download",
    commit: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--sync-only") {
      options.syncOnly = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value) {
      throw new Error(`Valor ausente para o argumento ${arg}`);
    }
    index += 1;

    if (arg === "--apk") options.apk = value;
    else if (arg === "--env") options.env = value;
    else if (arg === "--version") options.version = value;
    else if (arg === "--version-code") options.versionCode = Number.parseInt(value, 10);
    else if (arg === "--base-url") options.baseUrl = value;
    else if (arg === "--filename") options.filename = value;
    else if (arg === "--notes") options.notes = value;
    else if (arg === "--out") options.out = value;
    else if (arg === "--upload-r2") options.uploadR2 = value;
    else if (arg === "--sync-web-dir") options.syncWebDir = value;
    else if (arg === "--sync-backend-dir") options.syncBackendDir = value;
    else if (arg === "--feature") options.feature = value;
    else if (arg === "--commit") options.commit = value;
    else throw new Error(`Argumento desconhecido: ${arg}`);
  }

  return options;
}

function runCli(argv = process.argv.slice(2)) {
  const options = parseCliArgs(argv);
  const hasSyncWeb = Boolean(options.syncWebDir);
  const hasSyncBackend = Boolean(options.syncBackendDir);
  if (hasSyncWeb !== hasSyncBackend) {
    throw new Error("Informe --sync-web-dir e --sync-backend-dir juntos.");
  }

  if (options.syncOnly) {
    if (!hasSyncWeb || !hasSyncBackend) {
      throw new Error("--sync-only exige --sync-web-dir e --sync-backend-dir.");
    }
    const synced = writeCandidateReleaseManifests({
      webDir: options.syncWebDir,
      backendDir: options.syncBackendDir,
      env: options.env,
      feature: options.feature,
      commit: options.commit || undefined,
    });
    console.log(`[apk-release] Manifestos sincronizados (${synced.sourceHash})`);
    return { synced };
  }

  const { resolvedPath, fileSizeBytes } = validateApkFile(options.apk);
  const sha256 = computeFileSha256(resolvedPath);

  const { manifest, objectKey, filename } = buildApkReleaseObject({
    env: options.env,
    version: options.version,
    versionCode: options.versionCode,
    baseUrl: options.baseUrl,
    apkFilename: options.filename || undefined,
    sha256,
    fileSizeBytes,
    releaseNotes: options.notes || undefined,
  });

  if (options.uploadR2) {
    const r2Args = buildR2UploadArgs({
      bucket: options.uploadR2,
      objectKey,
      apkPath: resolvedPath,
      downloadFilename: filename,
    });
    executeWranglerUpload(r2Args);
  }

  const serialized = JSON.stringify(manifest, null, 2) + "\n";
  const resolvedOutPath = options.out
    ? path.resolve(options.out)
    : hasSyncWeb
      ? path.resolve(options.syncWebDir, "apk-release.json")
      : null;

  if (resolvedOutPath) {
    fs.mkdirSync(path.dirname(resolvedOutPath), { recursive: true });
    fs.writeFileSync(resolvedOutPath, serialized, "utf8");
    console.log(`[apk-release] Manifesto salvo em ${resolvedOutPath}`);
  } else {
    process.stdout.write(serialized);
  }

  let synced;
  if (hasSyncWeb && hasSyncBackend) {
    synced = writeCandidateReleaseManifests({
      webDir: options.syncWebDir,
      backendDir: options.syncBackendDir,
      env: options.env,
      feature: options.feature,
      apkVersion: manifest.version,
      apkVersionCode: manifest.versionCode,
      commit: options.commit || undefined,
    });
    console.log(`[apk-release] Manifestos sincronizados (${synced.sourceHash})`);
  }

  return { manifest, objectKey, filename, ...(synced ? { synced } : {}) };
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    console.error(`[apk-release] ERRO: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  ALLOWED_APK_BASE_HOSTS,
  buildApkReleaseObject,
  buildR2UploadArgs,
  computeCandidateSourceHash,
  computeFileSha256,
  defaultApkFilename,
  parseCliArgs,
  runCli,
  validateApkFile,
  writeCandidateReleaseManifests,
};
