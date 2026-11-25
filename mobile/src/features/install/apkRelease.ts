import { ApkReleaseMetadata } from "./types";

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const ALLOWED_APK_HOSTS = new Set([
  "downloads.laudaapp.com",
  "laudaapp.com",
  "testes.laudaapp.com",
]);
const MAX_ANDROID_VERSION_CODE = 2_147_483_647;

export const DEFAULT_APK_MANIFEST_URLS = {
  staging: "https://testes.laudaapp.com/apk-release.json",
  production: "https://laudaapp.com/apk-release.json",
} as const;

export function currentAppEnvironment(overrideEnv?: unknown): "staging" | "production" {
  const candidate = typeof overrideEnv === "string" ? overrideEnv : process.env.EXPO_PUBLIC_APP_ENV;
  return candidate === "staging" ? "staging" : "production";
}

function isAllowedManifestHost(parsed: URL): boolean {
  const hostname = parsed.hostname.toLowerCase();
  const isLoopback = LOOPBACK_HOSTS.has(hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLoopback)) {
    return false;
  }
  if (parsed.username || parsed.password) {
    return false;
  }
  return ALLOWED_APK_HOSTS.has(hostname) || isLoopback;
}

export function resolveApkManifestUrl(
  environment: "staging" | "production" = currentAppEnvironment(),
  overrideUrl?: unknown
): string {
  const candidates = [overrideUrl, process.env.EXPO_PUBLIC_APK_MANIFEST_URL];
  for (const rawCandidate of candidates) {
    if (typeof rawCandidate !== "string") continue;
    const trimmed = rawCandidate.trim();
    if (!trimmed) continue;
    try {
      const parsed = new URL(trimmed);
      if (isAllowedManifestHost(parsed)) {
        return parsed.toString();
      }
    } catch {
      // Ignore invalid override and continue to environment default.
    }
  }
  return DEFAULT_APK_MANIFEST_URLS[environment];
}

export function resolveSafeApkUrl(rawUrl: unknown, origin?: string): string | null {
  if (typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = trimmed.startsWith("/") && origin ? new URL(trimmed, origin) : new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.username || parsed.password) return null;
  const hostname = parsed.hostname.toLowerCase();
  const isLoopback = LOOPBACK_HOSTS.has(hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLoopback)) {
    return null;
  }
  if (!ALLOWED_APK_HOSTS.has(hostname) && !isLoopback) {
    return null;
  }
  if (!parsed.pathname.toLowerCase().endsWith(".apk")) {
    return null;
  }

  return parsed.toString();
}

export function parseApkReleaseManifest(
  raw: unknown,
  options: { expectedEnvironment?: "staging" | "production"; origin?: string } = {}
): ApkReleaseMetadata | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const candidate = raw as Record<string, unknown>;
  if (candidate.available !== true) return null;

  const expectedEnvironment = options.expectedEnvironment ?? currentAppEnvironment();
  const rawEnvironment = typeof candidate.environment === "string" ? candidate.environment.trim() : undefined;
  if (rawEnvironment && rawEnvironment !== "staging" && rawEnvironment !== "production") {
    return null;
  }
  if (rawEnvironment && rawEnvironment !== expectedEnvironment) {
    return null;
  }
  if (expectedEnvironment === "staging" && rawEnvironment !== "staging") {
    return null;
  }

  const version = typeof candidate.version === "string" ? candidate.version.trim() : "";
  if (!version || version.length > 64) return null;

  const sha256 = typeof candidate.sha256 === "string" ? candidate.sha256.trim().toLowerCase() : "";
  if (!SHA256_HEX_PATTERN.test(sha256)) return null;

  const safeUrl = resolveSafeApkUrl(candidate.url, options.origin);
  if (!safeUrl) return null;

  let versionCode: number | undefined;
  if (candidate.versionCode !== undefined) {
    if (
      typeof candidate.versionCode !== "number" ||
      !Number.isInteger(candidate.versionCode) ||
      candidate.versionCode <= 0 ||
      candidate.versionCode > MAX_ANDROID_VERSION_CODE
    ) {
      return null;
    }
    versionCode = candidate.versionCode;
  }

  let fileSizeBytes: number | undefined;
  if (candidate.fileSizeBytes !== undefined) {
    if (
      typeof candidate.fileSizeBytes !== "number" ||
      !Number.isInteger(candidate.fileSizeBytes) ||
      candidate.fileSizeBytes <= 0
    ) {
      return null;
    }
    fileSizeBytes = candidate.fileSizeBytes;
  }

  let publishedAt: string | undefined;
  if (candidate.publishedAt !== undefined) {
    if (typeof candidate.publishedAt !== "string") return null;
    const trimmedDate = candidate.publishedAt.trim();
    if (!trimmedDate || Number.isNaN(Date.parse(trimmedDate))) return null;
    publishedAt = trimmedDate;
  }

  const releaseNotes =
    typeof candidate.releaseNotes === "string" && candidate.releaseNotes.trim()
      ? candidate.releaseNotes.trim().slice(0, 240)
      : undefined;

  return {
    available: true,
    version,
    url: safeUrl,
    sha256,
    ...(rawEnvironment ? { environment: rawEnvironment as "staging" | "production" } : {}),
    ...(versionCode !== undefined ? { versionCode } : {}),
    ...(fileSizeBytes !== undefined ? { fileSizeBytes } : {}),
    ...(publishedAt ? { publishedAt } : {}),
    ...(releaseNotes ? { releaseNotes } : {}),
  };
}

function parseSemverTuple(rawVersion: string): [number, number, number] | null {
  const cleaned = rawVersion.trim().replace(/^v/i, "").split(/[-+]/, 1)[0];
  if (!cleaned) return null;
  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(cleaned);
  if (!match) return null;
  return [
    Number.parseInt(match[1], 10),
    Number.parseInt(match[2] ?? "0", 10),
    Number.parseInt(match[3] ?? "0", 10),
  ];
}

export function compareSemver(left: string, right: string): -1 | 0 | 1 {
  const leftTuple = parseSemverTuple(left);
  const rightTuple = parseSemverTuple(right);
  if (!leftTuple || !rightTuple) return 0;

  for (let index = 0; index < 3; index += 1) {
    if (leftTuple[index] > rightTuple[index]) return 1;
    if (leftTuple[index] < rightTuple[index]) return -1;
  }
  return 0;
}

export function isApkUpdateAvailable(
  installed: { version?: string | null; versionCode?: number | null },
  remote: ApkReleaseMetadata | null
): boolean {
  if (!remote) return false;

  if (
    typeof remote.versionCode === "number" &&
    Number.isInteger(remote.versionCode) &&
    remote.versionCode > 0 &&
    typeof installed.versionCode === "number" &&
    Number.isInteger(installed.versionCode) &&
    installed.versionCode > 0
  ) {
    return remote.versionCode > installed.versionCode;
  }

  if (typeof installed.version === "string" && installed.version.trim()) {
    return compareSemver(remote.version, installed.version) > 0;
  }

  return false;
}

export function formatApkSize(bytes?: number): string | null {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) {
    return null;
  }
  if (bytes >= 1024 * 1024) {
    const megabytes = bytes / (1024 * 1024);
    if (megabytes >= 100) {
      return `${Math.round(megabytes)} MB`;
    }
    const rounded = Math.round(megabytes * 10) / 10;
    return rounded % 1 === 0
      ? `${rounded} MB`
      : `${rounded.toFixed(1).replace(".", ",")} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${Math.round(bytes)} B`;
}
