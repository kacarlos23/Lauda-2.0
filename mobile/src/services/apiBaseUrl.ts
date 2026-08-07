import { Platform } from "react-native";
import Constants from "expo-constants";
import { ApiBaseUrlOptions, normalizeApiBaseUrl } from "./apiBaseUrl.shared";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function extractExpoHost(hostUri: string | null | undefined): string | null {
  if (!hostUri) return null;

  try {
    return new URL(hostUri.includes("://") ? hostUri : `http://${hostUri}`).hostname;
  } catch {
    return null;
  }
}

function replaceNativeLoopbackHost(baseUrl: string, expoHost: string | null): string {
  if (!expoHost) return baseUrl;

  try {
    const parsed = new URL(baseUrl);
    if (!LOOPBACK_HOSTS.has(parsed.hostname)) return baseUrl;
    parsed.hostname = expoHost;
    return normalizeApiBaseUrl(parsed.toString());
  } catch {
    return baseUrl;
  }
}

export function resolveApiBaseUrl(options: ApiBaseUrlOptions = {}): string {
  const envUrl = options.envUrl ?? process.env.EXPO_PUBLIC_API_URL?.trim();
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  const platform = options.platform ?? Platform.OS;
  const expoGoConfig = (Constants as typeof Constants & { expoGoConfig?: { debuggerHost?: string | null } }).expoGoConfig;
  const expoHostUri = options.expoHostUri === undefined
    ? Constants.expoConfig?.hostUri ?? expoGoConfig?.debuggerHost
    : options.expoHostUri;
  const expoHost = extractExpoHost(expoHostUri);

  if (envUrl) {
    const normalized = normalizeApiBaseUrl(envUrl);
    return nodeEnv !== "production" && platform !== "web"
      ? replaceNativeLoopbackHost(normalized, expoHost)
      : normalized;
  }

  if (nodeEnv === "production") {
    throw new Error(
      "EXPO_PUBLIC_API_URL is required in production. Refusing to build a frontend that falls back to localhost."
    );
  }

  if (platform !== "web" && expoHost) {
    return normalizeApiBaseUrl(`http://${expoHost}:3000/api`);
  }

  if (platform === "android") {
    return normalizeApiBaseUrl("http://10.0.2.2:3000/api");
  }

  return normalizeApiBaseUrl("http://localhost:3000/api");
}

export { normalizeApiBaseUrl } from "./apiBaseUrl.shared";
