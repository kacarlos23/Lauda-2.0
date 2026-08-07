import { ApiBaseUrlOptions, normalizeApiBaseUrl } from "./apiBaseUrl.shared";

export function resolveApiBaseUrl(options: ApiBaseUrlOptions = {}): string {
  const envUrl = options.envUrl ?? process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!envUrl) {
    throw new Error("EXPO_PUBLIC_API_URL is required on web. Refusing to use a local API fallback.");
  }

  return normalizeApiBaseUrl(envUrl);
}

export { normalizeApiBaseUrl } from "./apiBaseUrl.shared";
