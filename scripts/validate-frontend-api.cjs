"use strict";

const fs = require("node:fs");
const path = require("node:path");

const LOCAL_API_MARKERS = [
  "localhost:3000",
  "127.0.0.1:3000",
  "10.0.2.2:3000",
];

function parseHttpUrl(rawValue, label) {
  const value = String(rawValue ?? "").trim().replace(/\/+$/, "");
  if (!value) {
    throw new Error(`${label} is required`);
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute HTTP(S) URL`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`${label} must use HTTP or HTTPS`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${label} must not contain credentials`);
  }

  const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !isLoopback) {
    throw new Error(`${label} must use HTTPS outside loopback`);
  }

  return { value, parsed, isLoopback };
}

function validateExpectedApiUrl(rawValue = process.env.EXPO_PUBLIC_API_URL) {
  return parseHttpUrl(rawValue, "EXPO_PUBLIC_API_URL");
}

function validateBundleSources(sources, expectedApiUrl) {
  const expected = validateExpectedApiUrl(expectedApiUrl);
  const combinedSource = sources.map(({ content }) => content).join("\n");

  if (!combinedSource.includes(expected.value)) {
    throw new Error(`Frontend bundle does not contain the expected API URL: ${expected.value}`);
  }

  if (!expected.isLoopback) {
    const leakedMarkers = LOCAL_API_MARKERS.filter((marker) => combinedSource.includes(marker));
    if (leakedMarkers.length > 0) {
      throw new Error(`Public frontend bundle contains local API fallback(s): ${leakedMarkers.join(", ")}`);
    }
  }

  return {
    expectedApiUrl: expected.value,
    sourceCount: sources.length,
  };
}

function listJavaScriptFiles(directory) {
  if (!fs.existsSync(directory)) {
    throw new Error(`Frontend bundle directory does not exist: ${directory}`);
  }

  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJavaScriptFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(entryPath);
    }
  }
  return files;
}

function validateDist(distDirectory, expectedApiUrl = process.env.EXPO_PUBLIC_API_URL) {
  const bundleDirectory = path.resolve(distDirectory, "_expo", "static", "js", "web");
  const bundleFiles = listJavaScriptFiles(bundleDirectory);
  if (bundleFiles.length === 0) {
    throw new Error(`No JavaScript bundle was found in ${bundleDirectory}`);
  }

  const sources = bundleFiles.map((filePath) => ({
    name: filePath,
    content: fs.readFileSync(filePath, "utf8"),
  }));
  return validateBundleSources(sources, expectedApiUrl);
}

function extractJavaScriptUrls(html, siteUrl) {
  const urls = [];
  const scriptPattern = /<script\b[^>]*\bsrc=(?:"([^"]+)"|'([^']+)')[^>]*>/gi;
  let match;

  while ((match = scriptPattern.exec(html)) !== null) {
    const source = match[1] ?? match[2];
    const url = new URL(source, siteUrl);
    if (url.pathname.endsWith(".js") && url.pathname.includes("/_expo/static/js/web/")) {
      urls.push(url.toString());
    }
  }

  return [...new Set(urls)];
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }
  return response.text();
}

async function validatePublicSite(siteUrl, expectedApiUrl) {
  const site = parseHttpUrl(siteUrl, "site URL");
  const html = await fetchText(site.value);
  const bundleUrls = extractJavaScriptUrls(html, site.value);
  if (bundleUrls.length === 0) {
    throw new Error(`No Expo web bundle was found at ${site.value}`);
  }

  const sources = await Promise.all(
    bundleUrls.map(async (url) => ({
      name: url,
      content: await fetchText(url),
    }))
  );
  return validateBundleSources(sources, expectedApiUrl);
}

function parseArguments(argv) {
  const options = {
    environment: false,
    dist: null,
    siteUrl: null,
    expectedApiUrl: null,
    retries: 1,
    retryDelayMs: 0,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--environment") {
      options.environment = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value) {
      throw new Error(`Missing value for ${argument}`);
    }
    index += 1;

    if (argument === "--dist") options.dist = value;
    else if (argument === "--site-url") options.siteUrl = value;
    else if (argument === "--expected-api-url") options.expectedApiUrl = value;
    else if (argument === "--retries") options.retries = Number.parseInt(value, 10);
    else if (argument === "--retry-delay-ms") options.retryDelayMs = Number.parseInt(value, 10);
    else throw new Error(`Unknown argument: ${argument}`);
  }

  if (!Number.isInteger(options.retries) || options.retries < 1) {
    throw new Error("--retries must be a positive integer");
  }
  if (!Number.isInteger(options.retryDelayMs) || options.retryDelayMs < 0) {
    throw new Error("--retry-delay-ms must be a non-negative integer");
  }

  return options;
}

async function retry(operation, attempts, delayMs) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const expectedApiUrl = options.expectedApiUrl ?? process.env.EXPO_PUBLIC_API_URL;

  let result;
  if (options.environment) {
    const expected = validateExpectedApiUrl(expectedApiUrl);
    result = { expectedApiUrl: expected.value, sourceCount: 0 };
  } else if (options.dist) {
    result = validateDist(options.dist, expectedApiUrl);
  } else if (options.siteUrl) {
    result = await retry(
      () => validatePublicSite(options.siteUrl, expectedApiUrl),
      options.retries,
      options.retryDelayMs
    );
  } else {
    throw new Error("Use --environment, --dist, or --site-url");
  }

  console.log(
    `[frontend-api] OK: ${result.expectedApiUrl}` +
      (result.sourceCount ? ` (${result.sourceCount} bundle(s) checked)` : "")
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[frontend-api] ERROR: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  extractJavaScriptUrls,
  parseArguments,
  parseHttpUrl,
  retry,
  validateBundleSources,
  validateDist,
  validateExpectedApiUrl,
  validatePublicSite,
};
