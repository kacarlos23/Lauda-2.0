import type { PlatformInstallAdapter, PlatformInstallSnapshot } from "./types";

const NATIVE_SNAPSHOT: PlatformInstallSnapshot = {
  supported: false,
  installed: true,
  canPrompt: false,
  channel: "native-app",
};

export const platformInstallAdapter: PlatformInstallAdapter = {
  getSnapshot: () => NATIVE_SNAPSHOT,
  subscribe: () => () => undefined,
  triggerPrompt: async () => "unavailable",
  registerServiceWorker: async () => false,
  fetchApkManifest: async () => null,
};
