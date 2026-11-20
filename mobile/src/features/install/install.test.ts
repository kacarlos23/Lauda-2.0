import { parseApkReleaseManifest } from "./apkRelease";
import { platformInstallAdapter as nativeAdapter } from "./platformInstall";
import { useInstallStore } from "./installStore";

describe("parseApkReleaseManifest", () => {
  const validHash = "a".repeat(64);

  it("aceita manifesto válido para produção e rejeita URLs inseguras ou hashes inválidos", () => {
    expect(
      parseApkReleaseManifest(
        {
          available: true,
          version: "1.0.2",
          url: "https://laudaapp.com/downloads/lauda-1.0.2.apk",
          sha256: validHash.toUpperCase(),
          environment: "production",
        },
        { expectedEnvironment: "production" }
      )
    ).toEqual({
      available: true,
      version: "1.0.2",
      url: "https://laudaapp.com/downloads/lauda-1.0.2.apk",
      sha256: validHash,
      environment: "production",
    });

    expect(parseApkReleaseManifest({ available: false })).toBeNull();
    expect(
      parseApkReleaseManifest(
        { available: true, version: "1.0.0", url: "javascript:alert(1)", sha256: validHash },
        { expectedEnvironment: "production" }
      )
    ).toBeNull();
    expect(
      parseApkReleaseManifest(
        { available: true, version: "1.0.0", url: "http://laudaapp.com/app.apk", sha256: validHash },
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
          url: "https://laudaapp.com/app.apk",
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
          url: "https://testes.laudaapp.com/app.apk",
          sha256: validHash,
          environment: "staging",
        },
        { expectedEnvironment: "production" }
      )
    ).toBeNull();
  });
});

describe("native platformInstallAdapter", () => {
  it("retorna interface vazia/no-op para instalação web em ambiente nativo", async () => {
    expect(nativeAdapter.getSnapshot()).toEqual({
      supported: false,
      installed: true,
      canPrompt: false,
      channel: "native-app",
    });
    await expect(nativeAdapter.triggerPrompt()).resolves.toBe("unavailable");
    await expect(nativeAdapter.registerServiceWorker()).resolves.toBe(false);
    await expect(nativeAdapter.fetchApkManifest()).resolves.toBeNull();
  });
});

describe("platformInstall.web and installStore", () => {
  const originalWindow = (globalThis as { window?: unknown }).window;
  const originalNavigator = (globalThis as { navigator?: unknown }).navigator;
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    useInstallStore.getState().reset();
    (globalThis as { window?: unknown }).window = originalWindow;
    (globalThis as { navigator?: unknown }).navigator = originalNavigator;
    globalThis.fetch = originalFetch;
    jest.resetModules();
  });

  it("captura beforeinstallprompt, trata cancelamento sem travar e oculta no modo standalone", async () => {
    const listeners = new Map<string, Array<(event?: any) => void>>();
    let standalone = false;

    const fakeWindow = {
      location: { protocol: "https:", hostname: "laudaapp.com", origin: "https://laudaapp.com" },
      addEventListener: (type: string, handler: (event?: any) => void) => {
        listeners.set(type, [...(listeners.get(type) ?? []), handler]);
      },
      matchMedia: () => ({
        get matches() {
          return standalone;
        },
        addEventListener: jest.fn(),
      }),
    };

    (globalThis as { window?: unknown }).window = fakeWindow;
    (globalThis as { navigator?: unknown }).navigator = {
      userAgent: "Mozilla/5.0 (Linux; Android 14)",
      maxTouchPoints: 5,
    };

    const webModule = require("./platformInstall.web") as typeof import("./platformInstall.web");
    const adapter = webModule.platformInstallAdapter;

    expect(adapter.getSnapshot()).toMatchObject({
      supported: true,
      installed: false,
      canPrompt: false,
      channel: "manual-browser",
    });

    const promptMock = jest.fn().mockResolvedValue(undefined);
    const preventDefault = jest.fn();
    for (const handler of listeners.get("beforeinstallprompt") ?? []) {
      handler({
        preventDefault,
        prompt: promptMock,
        userChoice: Promise.resolve({ outcome: "dismissed" }),
      });
    }

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(adapter.getSnapshot()).toMatchObject({
      supported: true,
      installed: false,
      canPrompt: true,
      channel: "browser-prompt",
    });

    await expect(adapter.triggerPrompt()).resolves.toBe("dismissed");
    expect(promptMock).toHaveBeenCalledTimes(1);
    // Depois do cancelamento, continua acionável via instruções manuais
    await expect(adapter.triggerPrompt()).resolves.toBe("instructions");

    // Em modo standalone, oculta instalação
    standalone = true;
    expect(adapter.getSnapshot().installed).toBe(true);
    await expect(adapter.triggerPrompt()).resolves.toBe("unavailable");
  });

  it("identifica iOS Safari com instruções de Tela de Início", () => {
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

    const webModule = require("./platformInstall.web") as typeof import("./platformInstall.web");
    expect(webModule.platformInstallAdapter.getSnapshot()).toEqual({
      supported: true,
      installed: false,
      canPrompt: false,
      channel: "ios-safari",
    });
  });
});
