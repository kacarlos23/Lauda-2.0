import { create } from "zustand";
import { platformInstallAdapter } from "./platformInstall";
import type { ApkReleaseMetadata, InstallChannel, InstallOutcome } from "./types";

interface InstallState {
  supported: boolean;
  installed: boolean;
  canPrompt: boolean;
  channel: InstallChannel;
  outcome: InstallOutcome;
  instructionsVisible: boolean;
  apkRelease: ApkReleaseMetadata | null;
  initialized: boolean;
  prompting: boolean;
  initialize: () => () => void;
  triggerInstall: () => Promise<InstallOutcome>;
  openInstructions: () => void;
  closeInstructions: () => void;
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
    outcome: "idle" as InstallOutcome,
    instructionsVisible: false,
    apkRelease: null as ApkReleaseMetadata | null,
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
      initialized: true,
    });

    if (!activeUnsubscribe && snapshot.supported) {
      activeUnsubscribe = platformInstallAdapter.subscribe((next) => {
        set({
          supported: next.supported,
          installed: next.installed,
          canPrompt: next.canPrompt,
          channel: next.channel,
          ...(next.installed ? { instructionsVisible: false, outcome: "accepted" as const } : {}),
        });
      });
      void platformInstallAdapter.registerServiceWorker();
    }

    if (snapshot.supported && !apkFetchPromise && get().apkRelease === null) {
      apkFetchPromise = platformInstallAdapter
        .fetchApkManifest()
        .then((manifest) => {
          set({ apkRelease: manifest });
        })
        .catch(() => undefined)
        .finally(() => {
          apkFetchPromise = null;
        });
    }

    return () => {
      if (activeUnsubscribe) {
        activeUnsubscribe();
        activeUnsubscribe = null;
      }
    };
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

  openInstructions: () => set({ instructionsVisible: true }),
  closeInstructions: () => set({ instructionsVisible: false }),

  reset: () => {
    if (activeUnsubscribe) {
      activeUnsubscribe();
      activeUnsubscribe = null;
    }
    apkFetchPromise = null;
    set(initialState());
  },
}));
