import { ApiBaseUrlOptions, normalizeApiBaseUrl } from "./apiBaseUrl.shared";

export function resolveApiBaseUrl(options: ApiBaseUrlOptions = {}): string {
  const envUrl = options.envUrl ?? process.env.EXPO_PUBLIC_API_URL?.trim();
  if (process.env.EXPO_PUBLIC_APP_ENV === "staging" && envUrl !== "https://testes.laudaapp.com/api") {
    throw new Error("O ambiente de testes exige sua API isolada em testes.laudaapp.com.");
  }
  if (!envUrl) {
    throw new Error("EXPO_PUBLIC_API_URL is required on web. Refusing to use a local API fallback.");
  }

  return normalizeApiBaseUrl(envUrl);
}

export { normalizeApiBaseUrl } from "./apiBaseUrl.shared";

