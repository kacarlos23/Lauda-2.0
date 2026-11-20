import { currentAppEnvironment, parseApkReleaseManifest } from "./apkRelease";
import type { InstallOutcome, PlatformInstallAdapter, PlatformInstallSnapshot } from "./types";

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

function computeSnapshot(): PlatformInstallSnapshot {
  if (typeof window === "undefined") {
    return { supported: false, installed: false, canPrompt: false, channel: "manual-browser" };
  }
  const installed = isStandaloneMode();
  const canPrompt = Boolean(deferredPrompt) && !installed;
  const channel = canPrompt
    ? "browser-prompt"
    : isIosDevice()
      ? "ios-safari"
      : "manual-browser";

  return {
    supported: true,
    installed,
    canPrompt,
    channel,
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
    if (typeof window === "undefined" || typeof fetch !== "function") return null;
    try {
      const response = await fetch("/apk-release.json", {
        headers: { "Cache-Control": "no-cache" },
      });
      if (!response.ok) return null;
      const data: unknown = await response.json();
      return parseApkReleaseManifest(data, {
        expectedEnvironment: currentAppEnvironment(),
        origin: window.location.origin,
      });
    } catch {
      return null;
    }
  },
};

export function __resetWebInstallForTests() {
  deferredPrompt = null;
  subscribers.clear();
  listenersBound = false;
}
