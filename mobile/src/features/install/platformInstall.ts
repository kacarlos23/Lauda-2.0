import {
  currentAppEnvironment,
  parseApkReleaseManifest,
  resolveApkManifestUrl,
} from "./apkRelease";
import type {
  ApkManifestFetchResult,
  DeviceClass,
  PlatformInstallAdapter,
  PlatformInstallSnapshot,
} from "./types";

function loadReactNative(): typeof import("react-native") | null {
  try {
    return require("react-native") as typeof import("react-native");
  } catch {
    return null;
  }
}

function loadApplication(): typeof import("expo-application") | null {
  try {
    return require("expo-application") as typeof import("expo-application");
  } catch {
    return null;
  }
}

function loadConstants(): typeof import("expo-constants").default | null {
  try {
    const mod = require("expo-constants");
    return (mod?.default ?? mod ?? null) as typeof import("expo-constants").default | null;
  } catch {
    return null;
  }
}

function parsePositiveVersionCode(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isInteger(raw) && raw > 0) return raw;
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    const parsed = Number.parseInt(raw.trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function computeNativeSnapshot(): PlatformInstallSnapshot {
  const rn = loadReactNative();
  const app = loadApplication();
  const constants = loadConstants();
  const os = rn?.Platform?.OS;
  const deviceClass: DeviceClass = os === "ios" ? "ios" : "android";

  const rawVersion = app?.nativeApplicationVersion ?? constants?.expoConfig?.version ?? null;
  const installedVersion = typeof rawVersion === "string" && rawVersion.trim()
    ? rawVersion.trim()
    : null;
  const installedVersionCode = parsePositiveVersionCode(
    app?.nativeBuildVersion ?? constants?.expoConfig?.android?.versionCode
  );

  return {
    supported: false,
    installed: true,
    canPrompt: false,
    channel: "native-app",
    deviceClass,
    isNativeApp: true,
    installedVersion,
    installedVersionCode,
  };
}

async function fetchRemoteAndroidManifest(): Promise<ApkManifestFetchResult> {
  const rn = loadReactNative();
  if (rn?.Platform?.OS !== "android" || typeof fetch !== "function") {
    return { ok: true, manifest: null };
  }

  const constants = loadConstants();
  const extra = constants?.expoConfig?.extra as { appEnv?: unknown; apkManifestUrl?: unknown } | undefined;
  const expectedEnvironment = currentAppEnvironment(extra?.appEnv);
  const manifestUrl = resolveApkManifestUrl(expectedEnvironment, extra?.apkManifestUrl);

  try {
    const signal =
      typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(8000)
        : undefined;
    const response = await fetch(manifestUrl, {
      headers: { "Cache-Control": "no-cache" },
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) {
      return { ok: false, manifest: null };
    }
    const data: unknown = await response.json();
    return {
      ok: true,
      manifest: parseApkReleaseManifest(data, { expectedEnvironment }),
    };
  } catch {
    return { ok: false, manifest: null };
  }
}

export const platformInstallAdapter: PlatformInstallAdapter = {
  getSnapshot: () => computeNativeSnapshot(),
  subscribe: () => () => undefined,
  triggerPrompt: async () => "unavailable",
  registerServiceWorker: async () => false,
  fetchApkManifest: async () => {
    const result = await fetchRemoteAndroidManifest();
    return result.manifest;
  },
  fetchApkManifestWithStatus: () => fetchRemoteAndroidManifest(),
  openApkDownload: async (url: string) => {
    const rn = loadReactNative();
    if (!rn?.Linking?.openURL) return false;
    try {
      await rn.Linking.openURL(url);
      return true;
    } catch {
      return false;
    }
  },
};
