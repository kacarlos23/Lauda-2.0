export type ApiBaseUrlOptions = {
  envUrl?: string;
  nodeEnv?: string;
  platform?: string;
  expoHostUri?: string | null;
};

export function normalizeApiBaseUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}
