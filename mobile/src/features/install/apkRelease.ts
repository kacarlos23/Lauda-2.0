import { ApkReleaseMetadata } from "./types";

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function currentAppEnvironment(): "staging" | "production" {
  return process.env.EXPO_PUBLIC_APP_ENV === "staging" ? "staging" : "production";
}

function resolveSafeApkUrl(rawUrl: unknown, origin?: string): string | null {
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
  const isLoopback = LOOPBACK_HOSTS.has(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLoopback)) {
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
    ...(releaseNotes ? { releaseNotes } : {}),
  };
}
