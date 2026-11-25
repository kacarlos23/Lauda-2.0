import { currentAppEnvironment, parseApkReleaseManifest } from "./apkRelease";
import type {
  ApkManifestFetchResult,
  DeviceClass,
  InstallOutcome,
  PlatformInstallAdapter,
  PlatformInstallSnapshot,
} from "./types";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let listenersBound = false;
const subscribers = new Set<(snapshot: PlatformInstallSnapshot) => void>();

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  const mediaMatch = typeof window.matchMedia === "function"
    ? window.matchMedia("(display-mode: standalone)").matches
    : false;
  const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { standalone?: boolean }) : undefined;
  return Boolean(mediaMatch || nav?.standalone === true);
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  return navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1;
}

function detectDeviceClass(): DeviceClass {
  if (isIosDevice()) return "ios";
  if (typeof navigator !== "undefined" && /android/i.test(navigator.userAgent || "")) {
    return "android";
  }
  return "desktop";
}

function computeSnapshot(): PlatformInstallSnapshot {
  if (typeof window === "undefined") {
    return {
      supported: false,
      installed: false,
      canPrompt: false,
      channel: "manual-browser",
      deviceClass: "desktop",
      isNativeApp: false,
      installedVersion: null,
      installedVersionCode: null,
    };
  }
  const installed = isStandaloneMode();
  const deviceClass = detectDeviceClass();
  const canPrompt = Boolean(deferredPrompt) && !installed;
  const channel = canPrompt
    ? "browser-prompt"
    : deviceClass === "ios"
      ? "ios-safari"
      : "manual-browser";

  return {
    supported: true,
    installed,
    canPrompt,
    channel,
    deviceClass,
    isNativeApp: false,
    installedVersion: null,
    installedVersionCode: null,
  };
}

function notifySubscribers() {
  const snapshot = computeSnapshot();
  subscribers.forEach((listener) => listener(snapshot));
}

function bindGlobalListeners() {
  if (listenersBound || typeof window === "undefined") return;
  listenersBound = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notifySubscribers();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notifySubscribers();
  });

  if (typeof window.matchMedia === "function") {
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", () => notifySubscribers());
    }
  }
}

bindGlobalListeners();

async function fetchWebApkManifest(): Promise<ApkManifestFetchResult> {
  if (typeof window === "undefined" || typeof fetch !== "function") {
    return { ok: true, manifest: null };
  }
  try {
    const response = await fetch("/apk-release.json", {
      headers: { "Cache-Control": "no-cache" },
    });
    if (!response.ok) return { ok: false, manifest: null };
    const data: unknown = await response.json();
    return {
      ok: true,
      manifest: parseApkReleaseManifest(data, {
        expectedEnvironment: currentAppEnvironment(),
        origin: window.location.origin,
      }),
    };
  } catch {
    return { ok: false, manifest: null };
  }
}

export const platformInstallAdapter: PlatformInstallAdapter = {
  getSnapshot: () => {
    bindGlobalListeners();
    return computeSnapshot();
  },

  subscribe: (listener) => {
    bindGlobalListeners();
    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
    };
  },

  triggerPrompt: async (): Promise<InstallOutcome> => {
    if (isStandaloneMode()) return "unavailable";
    if (!deferredPrompt) return "instructions";

    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    notifySubscribers();

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      notifySubscribers();
      return choice.outcome === "accepted" ? "accepted" : "dismissed";
    } catch {
      notifySubscribers();
      return "instructions";
    }
  },

  registerServiceWorker: async (): Promise<boolean> => {
    if (process.env.NODE_ENV !== "production") return false;
    if (typeof window === "undefined" || typeof navigator === "undefined") return false;
    if (!("serviceWorker" in navigator) || !navigator.serviceWorker?.register) return false;

    const isSecure = window.location.protocol === "https:" || LOOPBACK_HOSTS.has(window.location.hostname);
    if (!isSecure) return false;

    try {
      await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      return true;
    } catch {
      return false;
    }
  },

  fetchApkManifest: async () => {
    const result = await fetchWebApkManifest();
    return result.manifest;
  },

  fetchApkManifestWithStatus: () => fetchWebApkManifest(),

  openApkDownload: async (url: string): Promise<boolean> => {
    if (typeof window === "undefined") return false;
    try {
      if (typeof document !== "undefined" && document.body && typeof document.createElement === "function") {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.setAttribute("download", "");
        anchor.style.display = "none";
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        return true;
      }
      if (typeof window.open === "function") {
        window.open(url, "_blank", "noopener,noreferrer");
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
};

export function __resetWebInstallForTests() {
  deferredPrompt = null;
  subscribers.clear();
  listenersBound = false;
}
