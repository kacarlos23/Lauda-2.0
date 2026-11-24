import {
  compareSemver,
  formatApkSize,
  isApkUpdateAvailable,
  parseApkReleaseManifest,
  resolveApkManifestUrl,
  resolveSafeApkUrl,
} from "./apkRelease";
import { platformInstallAdapter as nativeAdapter } from "./platformInstall";
import { useInstallStore } from "./installStore";
import type { ApkReleaseMetadata } from "./types";

describe("parseApkReleaseManifest e utilitários de versão", () => {
  const validHash = "a".repeat(64);

  it("aceita manifesto válido no domínio downloads.laudaapp.com e valida campos opcionais", () => {
    expect(
      parseApkReleaseManifest(
        {
          available: true,
          version: "1.0.2",
          versionCode: 5,
          fileSizeBytes: 52_428_800,
          publishedAt: "2026-11-23T12:00:00.000Z",
          releaseNotes: "Correções e melhoria de desempenho.",
          url: "https://downloads.laudaapp.com/production/lauda-v1.0.2-b5.apk",
          sha256: validHash.toUpperCase(),
          environment: "production",
        },
        { expectedEnvironment: "production" }
      )
    ).toEqual({
      available: true,
      version: "1.0.2",
      versionCode: 5,
      fileSizeBytes: 52_428_800,
      publishedAt: "2026-11-23T12:00:00.000Z",
      releaseNotes: "Correções e melhoria de desempenho.",
      url: "https://downloads.laudaapp.com/production/lauda-v1.0.2-b5.apk",
      sha256: validHash,
      environment: "production",
    });

    expect(
      parseApkReleaseManifest(
        {
          available: true,
          version: "1.0.2",
          url: "/downloads/lauda-1.0.2.apk",
          sha256: validHash,
          environment: "production",
        },
        { expectedEnvironment: "production", origin: "https://laudaapp.com" }
      )?.url
    ).toBe("https://laudaapp.com/downloads/lauda-1.0.2.apk");
  });

  it("rejeita URLs externas, sem .apk, esquemas inseguros ou campos inválidos", () => {
    expect(parseApkReleaseManifest({ available: false })).toBeNull();
    expect(resolveSafeApkUrl("https://evil.example.com/lauda.apk")).toBeNull();
    expect(resolveSafeApkUrl("https://downloads.laudaapp.com/production/file.zip")).toBeNull();
    expect(resolveSafeApkUrl("javascript:alert(1)")).toBeNull();
    expect(resolveSafeApkUrl("http://laudaapp.com/app.apk")).toBeNull();

    expect(
      parseApkReleaseManifest(
        {
          available: true,
          version: "1.0.0",
          url: "https://evil.example.com/lauda.apk",
          sha256: validHash,
        },
        { expectedEnvironment: "production" }
      )
    ).toBeNull();

    expect(
      parseApkReleaseManifest(
        {
          available: true,
          version: "1.0.0",
          url: "https://downloads.laudaapp.com/production/lauda.zip",
          sha256: validHash,
        },
        { expectedEnvironment: "production" }
      )
    ).toBeNull();

    expect(
      parseApkReleaseManifest(
        {
          available: true,
          version: "1.0.0",
          versionCode: 0,
          url: "https://downloads.laudaapp.com/production/lauda.apk",
          sha256: validHash,
        },
        { expectedEnvironment: "production" }
      )
    ).toBeNull();

    expect(
      parseApkReleaseManifest(
        {
          available: true,
          version: "1.0.0",
          versionCode: 1.5,
          url: "https://downloads.laudaapp.com/production/lauda.apk",
          sha256: validHash,
        },
        { expectedEnvironment: "production" }
      )
    ).toBeNull();

    expect(
      parseApkReleaseManifest(
        {
          available: true,
          version: "1.0.0",
          fileSizeBytes: -10,
          url: "https://downloads.laudaapp.com/production/lauda.apk",
          sha256: validHash,
        },
        { expectedEnvironment: "production" }
      )
    ).toBeNull();

    expect(
      parseApkReleaseManifest(
        { available: true, version: "1.0.0", url: "https://laudaapp.com/app.apk", sha256: "curto" },
        { expectedEnvironment: "production" }
      )
    ).toBeNull();
  });

  it("bloqueia manifesto de produção em ambiente staging e vice-versa", () => {
    expect(
      parseApkReleaseManifest(
        {
          available: true,
          version: "1.0.2",
          url: "https://downloads.laudaapp.com/production/lauda.apk",
          sha256: validHash,
          environment: "production",
        },
        { expectedEnvironment: "staging" }
      )
    ).toBeNull();

    expect(
      parseApkReleaseManifest(
        {
          available: true,
          version: "1.0.2",
          url: "https://downloads.laudaapp.com/staging/lauda-testes.apk",
          sha256: validHash,
          environment: "staging",
        },
        { expectedEnvironment: "production" }
      )
    ).toBeNull();
  });

  it("compara versionCode e SemVer corretamente para detectar atualizações", () => {
    const remoteBase: ApkReleaseMetadata = {
      available: true,
      version: "1.0.0",
      versionCode: 2,
      url: "https://downloads.laudaapp.com/production/lauda-v1.0.0-b2.apk",
      sha256: validHash,
      environment: "production",
    };

    expect(isApkUpdateAvailable({ version: "1.0.0", versionCode: 1 }, remoteBase)).toBe(true);
    expect(isApkUpdateAvailable({ version: "1.0.0", versionCode: 2 }, remoteBase)).toBe(false);
    expect(isApkUpdateAvailable({ version: "1.0.0", versionCode: 3 }, remoteBase)).toBe(false);

    expect(compareSemver("1.1.0", "1.0.9")).toBe(1);
    expect(compareSemver("1.0.10", "1.0.2")).toBe(1);
    expect(compareSemver("v1.0.2", "1.0.2")).toBe(0);
    expect(compareSemver("1.0.1", "1.0.2")).toBe(-1);

    const remoteSemverOnly: ApkReleaseMetadata = {
      available: true,
      version: "1.1.0",
      url: "https://downloads.laudaapp.com/production/lauda-v1.1.0.apk",
      sha256: validHash,
    };
    expect(isApkUpdateAvailable({ version: "1.0.9" }, remoteSemverOnly)).toBe(true);
    expect(isApkUpdateAvailable({ version: "1.1.0" }, remoteSemverOnly)).toBe(false);
    expect(isApkUpdateAvailable({ version: "1.0.0" }, null)).toBe(false);
  });

  it("formata tamanho do APK e resolve URLs de manifesto por ambiente", () => {
    expect(formatApkSize(52_428_800)).toBe("50 MB");
    expect(formatApkSize(52_953_088)).toBe("50,5 MB");
    expect(formatApkSize(512_000)).toBe("500 KB");
    expect(formatApkSize(0)).toBeNull();
    expect(formatApkSize(undefined)).toBeNull();

    expect(resolveApkManifestUrl("staging")).toBe("https://testes.laudaapp.com/apk-release.json");
    expect(resolveApkManifestUrl("production")).toBe("https://laudaapp.com/apk-release.json");
    expect(resolveApkManifestUrl("production", "https://evil.example/apk.json")).toBe(
      "https://laudaapp.com/apk-release.json"
    );
  });
});

describe("native platformInstallAdapter", () => {
  it("retorna snapshot nativo seguro sem acionar rede quando React Native não está montado", async () => {
    expect(nativeAdapter.getSnapshot()).toEqual({
      supported: false,
      installed: true,
      canPrompt: false,
      channel: "native-app",
      deviceClass: "android",
      isNativeApp: true,
      installedVersion: null,
      installedVersionCode: null,
    });
    await expect(nativeAdapter.triggerPrompt()).resolves.toBe("unavailable");
    await expect(nativeAdapter.registerServiceWorker()).resolves.toBe(false);
    await expect(nativeAdapter.fetchApkManifest()).resolves.toBeNull();
  });

  it("detecta atualização disponível no Android nativo e abre download pelo Linking", async () => {
    const originalFetch = globalThis.fetch;
    const openURLMock = jest.fn().mockResolvedValue(undefined);
    const validHash = "b".repeat(64);
    let remoteManifest = {
      available: true,
      environment: "production",
      version: "1.0.0",
      versionCode: 2,
      url: "https://downloads.laudaapp.com/production/lauda-v1.0.0-b2.apk",
      sha256: validHash,
      fileSizeBytes: 48_000_000,
    };

    try {
      globalThis.fetch = jest.fn(async () => ({
        ok: true,
        json: async () => remoteManifest,
      })) as unknown as typeof fetch;

      jest.resetModules();
      jest.doMock("react-native", () => ({
        Platform: { OS: "android" },
        Linking: { openURL: openURLMock },
      }));
      jest.doMock("expo-application", () => ({
        nativeApplicationVersion: "1.0.0",
        nativeBuildVersion: "1",
      }));
      jest.doMock("expo-constants", () => ({
        default: {
          expoConfig: {
            version: "1.0.0",
            extra: {
              appEnv: "production",
              apkManifestUrl: "https://laudaapp.com/apk-release.json",
            },
          },
        },
      }));

      const { platformInstallAdapter } = require("./platformInstall") as typeof import("./platformInstall");
      const { useInstallStore: isolatedStore } = require("./installStore") as typeof import("./installStore");

      expect(platformInstallAdapter.getSnapshot()).toEqual({
        supported: false,
        installed: true,
        canPrompt: false,
        channel: "native-app",
        deviceClass: "android",
        isNativeApp: true,
        installedVersion: "1.0.0",
        installedVersionCode: 1,
      });

      const cleanup = isolatedStore.getState().initialize();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(isolatedStore.getState().updateAvailable).toBe(true);
      expect(isolatedStore.getState().updateCheckStatus).toBe("available");
      expect(isolatedStore.getState().apkRelease?.versionCode).toBe(2);

      const downloaded = await isolatedStore.getState().downloadApk();
      expect(downloaded).toBe(true);
      expect(openURLMock).toHaveBeenCalledWith(remoteManifest.url);

      // Versão igual não sinaliza atualização
      remoteManifest = { ...remoteManifest, versionCode: 1 };
      await isolatedStore.getState().checkForUpdates({ force: true });
      expect(isolatedStore.getState().updateAvailable).toBe(false);
      expect(isolatedStore.getState().updateCheckStatus).toBe("up-to-date");

      // Falha de rede sinaliza erro sem apagar manifesto conhecido
      (globalThis.fetch as jest.Mock).mockRejectedValueOnce(new Error("offline"));
      await isolatedStore.getState().checkForUpdates({ force: true });
      expect(isolatedStore.getState().updateCheckStatus).toBe("error");
      expect(isolatedStore.getState().apkRelease?.versionCode).toBe(1);

      cleanup();
    } finally {
      globalThis.fetch = originalFetch;
      jest.dontMock("react-native");
      jest.dontMock("expo-application");
      jest.dontMock("expo-constants");
      jest.resetModules();
    }
  });
});

describe("platformInstall.web and installStore", () => {
  const originalWindow = (globalThis as { window?: unknown }).window;
  const originalNavigator = (globalThis as { navigator?: unknown }).navigator;
  const originalDocument = (globalThis as { document?: unknown }).document;
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    useInstallStore.getState().reset();
    (globalThis as { window?: unknown }).window = originalWindow;
    (globalThis as { navigator?: unknown }).navigator = originalNavigator;
    (globalThis as { document?: unknown }).document = originalDocument;
    globalThis.fetch = originalFetch;
    jest.resetModules();
  });

  it("classifica Android, desktop e iOS e continua buscando apk-release.json no Android standalone", async () => {
    const listeners = new Map<string, Array<(event?: unknown) => void>>();
    let standalone = false;
    const validHash = "c".repeat(64);

    (globalThis as { window?: unknown }).window = {
      location: { protocol: "https:", hostname: "laudaapp.com", origin: "https://laudaapp.com" },
      addEventListener: (type: string, handler: (event?: unknown) => void) => {
        listeners.set(type, [...(listeners.get(type) ?? []), handler]);
      },
      matchMedia: () => ({
        get matches() {
          return standalone;
        },
        addEventListener: jest.fn(),
      }),
    };
    (globalThis as { navigator?: unknown }).navigator = {
      userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7)",
      maxTouchPoints: 5,
    };
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        available: true,
        environment: "production",
        version: "1.4.0",
        versionCode: 4,
        url: "https://downloads.laudaapp.com/production/lauda-v1.4.0-b4.apk",
        sha256: validHash,
      }),
    })) as unknown as typeof fetch;

    const webModule = require("./platformInstall.web") as typeof import("./platformInstall.web");
    const adapter = webModule.platformInstallAdapter;

    expect(adapter.getSnapshot()).toMatchObject({
      supported: true,
      installed: false,
      deviceClass: "android",
      isNativeApp: false,
    });

    standalone = true;
    expect(adapter.getSnapshot()).toMatchObject({
      supported: true,
      installed: true,
      deviceClass: "android",
    });

    const manifest = await adapter.fetchApkManifest();
    expect(manifest?.version).toBe("1.4.0");
    expect(globalThis.fetch).toHaveBeenCalledWith("/apk-release.json", {
      headers: { "Cache-Control": "no-cache" },
    });

    const clickedAnchors: Array<{ href: string; target: string; rel: string; downloadAttr: string | null }> = [];
    const bodyChildren: unknown[] = [];
    (globalThis as { document?: unknown }).document = {
      body: {
        appendChild: (node: unknown) => bodyChildren.push(node),
        removeChild: (node: unknown) => {
          const idx = bodyChildren.indexOf(node);
          if (idx >= 0) bodyChildren.splice(idx, 1);
        },
      },
      createElement: () => {
        const attrs = new Map<string, string>();
        const anchor = {
          href: "",
          target: "",
          rel: "",
          style: { display: "" },
          setAttribute: (k: string, v: string) => attrs.set(k, v),
          click: () => {
            clickedAnchors.push({
              href: anchor.href,
              target: anchor.target,
              rel: anchor.rel,
              downloadAttr: attrs.get("download") ?? null,
            });
          },
        };
        return anchor;
      },
    };

    await expect(
      adapter.openApkDownload("https://downloads.laudaapp.com/production/lauda-v1.4.0-b4.apk")
    ).resolves.toBe(true);
    expect(clickedAnchors).toEqual([
      {
        href: "https://downloads.laudaapp.com/production/lauda-v1.4.0-b4.apk",
        target: "_blank",
        rel: "noopener noreferrer",
        downloadAttr: "",
      },
    ]);
    expect(bodyChildren).toHaveLength(0);
  });

  it("identifica iOS Safari, iPadOS e Desktop corretamente", () => {
    (globalThis as { window?: unknown }).window = {
      location: { protocol: "https:", hostname: "laudaapp.com", origin: "https://laudaapp.com" },
      addEventListener: jest.fn(),
      matchMedia: () => ({ matches: false, addEventListener: jest.fn() }),
    };
    (globalThis as { navigator?: unknown }).navigator = {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      platform: "iPhone",
      maxTouchPoints: 5,
    };

    let webModule = require("./platformInstall.web") as typeof import("./platformInstall.web");
    expect(webModule.platformInstallAdapter.getSnapshot()).toMatchObject({
      supported: true,
      installed: false,
      channel: "ios-safari",
      deviceClass: "ios",
    });

    jest.resetModules();
    (globalThis as { navigator?: unknown }).navigator = {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0",
      platform: "Win32",
      maxTouchPoints: 0,
    };
    webModule = require("./platformInstall.web") as typeof import("./platformInstall.web");
    expect(webModule.platformInstallAdapter.getSnapshot()).toMatchObject({
      supported: true,
      installed: false,
      channel: "manual-browser",
      deviceClass: "desktop",
    });
  });
});
