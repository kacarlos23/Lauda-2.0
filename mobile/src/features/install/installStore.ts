import { create } from "zustand";
import { isApkUpdateAvailable } from "./apkRelease";
import { platformInstallAdapter } from "./platformInstall";
import type {
  ApkReleaseMetadata,
  DeviceClass,
  InstallChannel,
  InstallOutcome,
  UpdateCheckStatus,
} from "./types";

const UPDATE_CHECK_THROTTLE_MS = 15 * 60 * 1000;

interface InstallState {
  supported: boolean;
  installed: boolean;
  canPrompt: boolean;
  channel: InstallChannel;
  deviceClass: DeviceClass;
  isNativeApp: boolean;
  installedVersion: string | null;
  installedVersionCode: number | null;
  outcome: InstallOutcome;
  instructionsVisible: boolean;
  apkGuideVisible: boolean;
  apkRelease: ApkReleaseMetadata | null;
  updateAvailable: boolean;
  checkingUpdate: boolean;
  updateCheckStatus: UpdateCheckStatus;
  lastCheckedAt: number | null;
  initialized: boolean;
  prompting: boolean;
  initialize: () => () => void;
  checkForUpdates: (options?: { force?: boolean }) => Promise<void>;
  triggerInstall: () => Promise<InstallOutcome>;
  downloadApk: () => Promise<boolean>;
  openInstructions: () => void;
  closeInstructions: () => void;
  openApkGuide: () => void;
  closeApkGuide: () => void;
  reset: () => void;
}

let activeUnsubscribe: (() => void) | null = null;
let apkFetchPromise: Promise<void> | null = null;

function initialState() {
  const snapshot = platformInstallAdapter.getSnapshot();
  return {
    supported: snapshot.supported,
    installed: snapshot.installed,
    canPrompt: snapshot.canPrompt,
    channel: snapshot.channel,
    deviceClass: snapshot.deviceClass,
    isNativeApp: snapshot.isNativeApp,
    installedVersion: snapshot.installedVersion,
    installedVersionCode: snapshot.installedVersionCode,
    outcome: "idle" as InstallOutcome,
    instructionsVisible: false,
    apkGuideVisible: false,
    apkRelease: null as ApkReleaseMetadata | null,
    updateAvailable: false,
    checkingUpdate: false,
    updateCheckStatus: "idle" as UpdateCheckStatus,
    lastCheckedAt: null as number | null,
    initialized: false,
    prompting: false,
  };
}

export const useInstallStore = create<InstallState>((set, get) => ({
  ...initialState(),

  initialize: () => {
    const snapshot = platformInstallAdapter.getSnapshot();
    set({
      supported: snapshot.supported,
      installed: snapshot.installed,
      canPrompt: snapshot.canPrompt,
      channel: snapshot.channel,
      deviceClass: snapshot.deviceClass,
      isNativeApp: snapshot.isNativeApp,
      installedVersion: snapshot.installedVersion,
      installedVersionCode: snapshot.installedVersionCode,
      initialized: true,
    });

    if (!activeUnsubscribe && snapshot.supported) {
      activeUnsubscribe = platformInstallAdapter.subscribe((next) => {
        set({
          supported: next.supported,
          installed: next.installed,
          canPrompt: next.canPrompt,
          channel: next.channel,
          deviceClass: next.deviceClass,
          isNativeApp: next.isNativeApp,
          installedVersion: next.installedVersion,
          installedVersionCode: next.installedVersionCode,
          ...(next.installed ? { instructionsVisible: false, outcome: "accepted" as const } : {}),
        });
      });
      void platformInstallAdapter.registerServiceWorker();
    }

    const shouldFetchManifest =
      snapshot.supported || (snapshot.isNativeApp && snapshot.deviceClass === "android");
    if (shouldFetchManifest) {
      void get().checkForUpdates({ force: false });
    }

    return () => {
      if (activeUnsubscribe) {
        activeUnsubscribe();
        activeUnsubscribe = null;
      }
    };
  },

  checkForUpdates: async (options = {}) => {
    const state = get();
    const shouldCheck =
      state.supported || (state.isNativeApp && state.deviceClass === "android");
    if (!shouldCheck) return;

    const now = Date.now();
    if (
      !options.force &&
      state.lastCheckedAt !== null &&
      now - state.lastCheckedAt < UPDATE_CHECK_THROTTLE_MS
    ) {
      return;
    }

    if (apkFetchPromise) {
      await apkFetchPromise;
      return;
    }

    set({ checkingUpdate: true });

    apkFetchPromise = (async () => {
      try {
        const result = platformInstallAdapter.fetchApkManifestWithStatus
          ? await platformInstallAdapter.fetchApkManifestWithStatus()
          : { ok: true, manifest: await platformInstallAdapter.fetchApkManifest() };

        if (!result.ok) {
          set({
            checkingUpdate: false,
            updateCheckStatus: "error",
          });
          return;
        }

        const current = get();
        const updateAvailable =
          current.isNativeApp && current.deviceClass === "android"
            ? isApkUpdateAvailable(
                {
                  version: current.installedVersion,
                  versionCode: current.installedVersionCode,
                },
                result.manifest
              )
            : false;

        set({
          apkRelease: result.manifest,
          updateAvailable,
          checkingUpdate: false,
          updateCheckStatus: updateAvailable ? "available" : "up-to-date",
          lastCheckedAt: Date.now(),
        });
      } catch {
        set({
          checkingUpdate: false,
          updateCheckStatus: "error",
        });
      } finally {
        apkFetchPromise = null;
      }
    })();

    await apkFetchPromise;
  },

  triggerInstall: async () => {
    if (get().prompting) return get().outcome;
    set({ prompting: true });
    try {
      const outcome = await platformInstallAdapter.triggerPrompt();
      if (outcome === "instructions") {
        set({ outcome, instructionsVisible: true, prompting: false });
      } else {
        set({ outcome, prompting: false });
      }
      return outcome;
    } finally {
      if (get().prompting) {
        set({ prompting: false });
      }
    }
  },

  downloadApk: async () => {
    const release = get().apkRelease;
    if (!release) return false;
    const opened = await platformInstallAdapter.openApkDownload(release.url);
    if (opened) {
      set({ apkGuideVisible: true });
    }
    return opened;
  },

  openInstructions: () => set({ instructionsVisible: true }),
  closeInstructions: () => set({ instructionsVisible: false }),
  openApkGuide: () => set({ apkGuideVisible: true }),
  closeApkGuide: () => set({ apkGuideVisible: false }),

  reset: () => {
    if (activeUnsubscribe) {
      activeUnsubscribe();
      activeUnsubscribe = null;
    }
    apkFetchPromise = null;
    set(initialState());
  },
}));
