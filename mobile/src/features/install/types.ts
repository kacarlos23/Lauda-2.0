export type InstallChannel = "native-app" | "browser-prompt" | "ios-safari" | "manual-browser";

export type DeviceClass = "android" | "ios" | "desktop";

export type InstallOutcome = "idle" | "accepted" | "dismissed" | "instructions" | "unavailable";

export type UpdateCheckStatus = "idle" | "up-to-date" | "available" | "error";

export type ApkReleaseMetadata = {
  available: true;
  version: string;
  url: string;
  sha256: string;
  environment?: "staging" | "production";
  releaseNotes?: string;
  versionCode?: number;
  fileSizeBytes?: number;
  publishedAt?: string;
};

export type ApkManifestFetchResult = {
  ok: boolean;
  manifest: ApkReleaseMetadata | null;
};

export type PlatformInstallSnapshot = {
  supported: boolean;
  installed: boolean;
  canPrompt: boolean;
  channel: InstallChannel;
  deviceClass: DeviceClass;
  isNativeApp: boolean;
  installedVersion: string | null;
  installedVersionCode: number | null;
};

export type PlatformInstallAdapter = {
  getSnapshot: () => PlatformInstallSnapshot;
  subscribe: (listener: (snapshot: PlatformInstallSnapshot) => void) => () => void;
  triggerPrompt: () => Promise<InstallOutcome>;
  registerServiceWorker: () => Promise<boolean>;
  fetchApkManifest: () => Promise<ApkReleaseMetadata | null>;
  fetchApkManifestWithStatus?: () => Promise<ApkManifestFetchResult>;
  openApkDownload: (url: string) => Promise<boolean>;
};
