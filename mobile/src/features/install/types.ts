export type InstallChannel = "native-app" | "browser-prompt" | "ios-safari" | "manual-browser";

export type InstallOutcome = "idle" | "accepted" | "dismissed" | "instructions" | "unavailable";

export type ApkReleaseMetadata = {
  available: true;
  version: string;
  url: string;
  sha256: string;
  environment?: "staging" | "production";
  releaseNotes?: string;
};

export type PlatformInstallSnapshot = {
  supported: boolean;
  installed: boolean;
  canPrompt: boolean;
  channel: InstallChannel;
};

export type PlatformInstallAdapter = {
  getSnapshot: () => PlatformInstallSnapshot;
  subscribe: (listener: (snapshot: PlatformInstallSnapshot) => void) => () => void;
  triggerPrompt: () => Promise<InstallOutcome>;
  registerServiceWorker: () => Promise<boolean>;
  fetchApkManifest: () => Promise<ApkReleaseMetadata | null>;
};
