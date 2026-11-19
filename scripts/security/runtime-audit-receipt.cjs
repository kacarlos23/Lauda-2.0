const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const platforms = ["web", "android", "ios"];
const maxAgeMs = 15 * 60 * 1000;

function execution() {
  if (process.env.GITHUB_ACTIONS !== "true") return null;
  const { GITHUB_RUN_ID: id, GITHUB_RUN_ATTEMPT: attempt, GITHUB_JOB: job, GITHUB_SHA: sha, RUNNER_TEMP: directory } = process.env;
  if (!/^\d+$/.test(id) || !/^\d+$/.test(attempt) || !job || !/^[\w-]+$/.test(job) ||
      !/^[a-f0-9]{40}$/.test(sha) || !directory || !path.isAbsolute(directory)) {
    throw new Error("GitHub Actions runtime audit context is incomplete");
  }
  return { id, attempt, job, sha, directory: fs.realpathSync(directory) };
}

function receiptPath(run) {
  return run
    ? path.join(run.directory, `lauda-runtime-${run.id}-${run.attempt}-${run.job}.json`)
    : path.join(root, ".tmp", "security-runtime-bundle.json");
}

function checkout(run) {
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  const commit = git("rev-parse", "HEAD").trim();
  if (run && commit !== run.sha) throw new Error("Runtime audit checkout does not match GITHUB_SHA");
  const paths = [...new Set(git("ls-files", "-z", "--cached", "--others", "--exclude-standard").split("\0").filter(Boolean))].sort();
  const hash = createHash("sha256");
  const openFlags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);
  for (const name of paths) {
    const file = path.join(root, name);
    let content = "deleted";
    let fd;
    try {
      fd = fs.openSync(file, openFlags);
    } catch (error) {
      if (error.code === "ELOOP") throw new Error(`Unexpected checkout entry: ${name}`);
      if (error.code !== "ENOENT") throw error;
    }
    if (fd !== undefined) {
      try {
        const stat = fs.fstatSync(fd);
        if (!stat.isFile()) throw new Error(`Unexpected checkout entry: ${name}`);
        content = createHash("sha256").update(fs.readFileSync(fd)).digest("hex");
      } finally {
        fs.closeSync(fd);
      }
    }
    hash.update(JSON.stringify([name, content]));
  }
  return { commit, sourceHash: hash.digest("hex") };
}

function clearReceipt(file) {
  const directory = fs.lstatSync(path.dirname(file), { throwIfNoEntry: false });
  if (directory && !directory.isDirectory()) throw new Error("Runtime audit receipt directory is not a regular directory");
  try {
    fs.unlinkSync(file);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function validateReceipt(receipt, { now, identity, run, stepOutcome }) {
  if (receipt?.status !== "passed" || receipt.schema_version !== 1 ||
      !Number.isSafeInteger(receipt.timestamp) || receipt.timestamp > now || now - receipt.timestamp > maxAgeMs) {
    throw new Error("Runtime audit receipt is missing, failed, or expired");
  }
  if (receipt.commit !== identity.commit || receipt.sourceHash !== identity.sourceHash || receipt.worktree !== root) {
    throw new Error("Runtime audit receipt does not match this checkout");
  }
  if (run ? stepOutcome !== "success" || receipt.run?.id !== run.id ||
      receipt.run?.attempt !== run.attempt || receipt.run?.job !== run.job : receipt.run !== null) {
    throw new Error("Runtime audit receipt does not match this successful CI job");
  }
  if (!Array.isArray(receipt.packages) || !receipt.packages.includes("picomatch") ||
      !Array.isArray(receipt.platforms) || receipt.platforms.length !== platforms.length ||
      !platforms.every((name) => receipt.platforms.some((entry) => entry?.name === name &&
        Number.isSafeInteger(entry.bundles) && entry.bundles > 0 &&
        Number.isSafeInteger(entry.maps) && entry.maps >= entry.bundles &&
        Number.isSafeInteger(entry.sources) && entry.sources >= entry.maps))) {
    throw new Error("Runtime audit receipt must cover picomatch on web, android, and ios");
  }
  return receipt;
}

function consumeReceipt(run, now) {
  const file = receiptPath(run);
  const dirStat = fs.lstatSync(path.dirname(file), { throwIfNoEntry: false });
  if (dirStat && !dirStat.isDirectory()) {
    throw new Error("Runtime audit receipt is not a regular file");
  }
  const openFlags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);
  let fd;
  try {
    fd = fs.openSync(file, openFlags);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error("Runtime audit receipt missing. Run npm run security:runtime-bundle first");
    }
    if (error.code === "ELOOP") {
      throw new Error("Runtime audit receipt is not a regular file");
    }
    throw error;
  }
  let receipt;
  try {
    if (!fs.fstatSync(fd).isFile()) {
      throw new Error("Runtime audit receipt is not a regular file");
    }
    receipt = JSON.parse(fs.readFileSync(fd, "utf8"));
  } finally {
    fs.closeSync(fd);
    try {
      fs.unlinkSync(file);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return validateReceipt(receipt, { now, identity: checkout(run), run, stepOutcome: process.env.RUNTIME_AUDIT_STEP_OUTCOME });
}

module.exports = { root, platforms, execution, receiptPath, checkout, clearReceipt, consumeReceipt, validateReceipt };
