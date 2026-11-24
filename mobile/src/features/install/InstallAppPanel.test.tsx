import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import type { ApkReleaseMetadata, DeviceClass, InstallChannel, UpdateCheckStatus } from "./types";

const sampleApk: ApkReleaseMetadata = {
  available: true,
  environment: "production",
  version: "1.4.0",
  versionCode: 4,
  fileSizeBytes: 52_428_800,
  releaseNotes: "Melhorias no acesso às cifras.",
  url: "https://downloads.laudaapp.com/production/lauda-v1.4.0-b4.apk",
  sha256: "d".repeat(64),
};

const downloadApkMock = jest.fn().mockResolvedValue(true);
const checkForUpdatesMock = jest.fn().mockResolvedValue(undefined);
const openApkGuideMock = jest.fn();
const closeApkGuideMock = jest.fn();
const triggerInstallMock = jest.fn().mockResolvedValue("instructions");
const closeInstructionsMock = jest.fn();

let currentInstallState: {
  supported: boolean;
  installed: boolean;
  canPrompt: boolean;
  channel: InstallChannel;
  deviceClass: DeviceClass;
  isNativeApp: boolean;
  installedVersion: string | null;
  installedVersionCode: number | null;
  outcome: "idle" | "accepted" | "dismissed" | "instructions" | "unavailable";
  instructionsVisible: boolean;
  apkGuideVisible: boolean;
  apkRelease: ApkReleaseMetadata | null;
  updateAvailable: boolean;
  checkingUpdate: boolean;
  updateCheckStatus: UpdateCheckStatus;
  lastCheckedAt: number | null;
  initialized: boolean;
  prompting: boolean;
};

jest.mock("react-native", () => {
  const ReactModule = require("react");
  const create = (type: string) => ({ children, ...rest }: any) =>
    ReactModule.createElement(type, rest, children);
  return {
    ActivityIndicator: create("ActivityIndicator"),
    Modal: ({ children, visible, ...rest }: any) =>
      visible ? ReactModule.createElement("Modal", rest, children) : null,
    Platform: { OS: "web", select: (values: any) => values.web ?? values.default },
    StyleSheet: { create: (styles: any) => styles },
    Text: create("Text"),
    TouchableOpacity: create("TouchableOpacity"),
    View: create("View"),
  };
});

jest.mock("lucide-react-native", () => {
  const ReactModule = require("react");
  const Icon = (props: any) => ReactModule.createElement("Icon", props);
  return {
    ChevronDown: Icon,
    ChevronUp: Icon,
    Download: Icon,
    RefreshCw: Icon,
    ShieldCheck: Icon,
    Smartphone: Icon,
    X: Icon,
  };
});

jest.mock("../../components/ui", () => {
  const ReactModule = require("react");
  return {
    Button: ({ title, ...rest }: any) =>
      ReactModule.createElement("Button", { ...rest, title }, title),
  };
});

jest.mock("../../components/ui/patterns", () => ({
  uiPatterns: { surface: {} },
}));

jest.mock("./installStore", () => ({
  useInstallStore: () => ({
    ...currentInstallState,
    initialize: () => () => undefined,
    checkForUpdates: checkForUpdatesMock,
    triggerInstall: triggerInstallMock,
    downloadApk: downloadApkMock,
    openInstructions: jest.fn(),
    closeInstructions: closeInstructionsMock,
    openApkGuide: openApkGuideMock,
    closeApkGuide: closeApkGuideMock,
    reset: jest.fn(),
  }),
}));

import { InstallAppPanel } from "./InstallAppPanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const originalConsoleError = console.error;

function setInstallState(overrides: Partial<typeof currentInstallState> = {}) {
  currentInstallState = {
    supported: true,
    installed: false,
    canPrompt: false,
    channel: "manual-browser",
    deviceClass: "android",
    isNativeApp: false,
    installedVersion: null,
    installedVersionCode: null,
    outcome: "idle",
    instructionsVisible: false,
    apkGuideVisible: false,
    apkRelease: sampleApk,
    updateAvailable: false,
    checkingUpdate: false,
    updateCheckStatus: "idle",
    lastCheckedAt: null,
    initialized: true,
    prompting: false,
    ...overrides,
  };
}

function renderPanel(
  overrides: Partial<typeof currentInstallState>,
  props: { variant?: "card" | "compact"; testIDPrefix?: string } = {}
) {
  setInstallState(overrides);
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<InstallAppPanel {...props} />);
  });
  const instance = renderer!;
  const allTexts = () =>
    instance.root
      .findAllByType("Text" as any)
      .map((node) => node.props.children)
      .flat()
      .join(" ");
  const findTestId = (id: string) =>
    instance.root.findAll((node) => typeof node.type === "string" && node.props?.testID === id);

  return { instance, allTexts, findTestId };
}

describe("InstallAppPanel UI por plataforma", () => {
  beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      if (String(args[0]).includes("react-test-renderer is deprecated")) return;
      originalConsoleError(...args);
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("exibe download APK e guia no Android web e continua visível no Android PWA standalone", () => {
    const webView = renderPanel(
      { deviceClass: "android", installed: false, apkGuideVisible: true },
      { variant: "card", testIDPrefix: "more-install" }
    );
    expect(webView.findTestId("more-install-apk-download-button")).toHaveLength(1);
    expect(webView.findTestId("more-install-apk-guide-button")).toHaveLength(1);
    expect(webView.findTestId("more-install-apk-guide-modal")).toHaveLength(1);
    expect(webView.findTestId("more-install-apk-checksum-details")).toHaveLength(0);

    act(() => {
      webView.findTestId("more-install-apk-checksum-toggle")[0].props.onPress();
    });
    expect(webView.findTestId("more-install-apk-checksum-details")).toHaveLength(1);

    const pwaStandaloneView = renderPanel(
      { deviceClass: "android", installed: true },
      { variant: "card", testIDPrefix: "more-install" }
    );
    expect(pwaStandaloneView.findTestId("more-install-apk-download-button")).toHaveLength(1);
  });

  it("exibe nota para desktop web e oculta quando apkRelease é nulo", () => {
    const desktopView = renderPanel(
      { deviceClass: "desktop", apkGuideVisible: true },
      { variant: "compact", testIDPrefix: "login-install" }
    );
    expect(desktopView.findTestId("login-install-apk-download-button")).toHaveLength(1);
    expect(desktopView.allTexts()).toContain("Instalador para celulares Android");
    expect(desktopView.findTestId("login-install-apk-desktop-note")).toHaveLength(1);

    const noApkView = renderPanel(
      { deviceClass: "android", apkRelease: null },
      { variant: "card", testIDPrefix: "more-install" }
    );
    expect(noApkView.instance.toJSON()).toBeNull();
  });

  it("exibe apenas Instalar no iPhone para iOS web e oculta no iOS standalone", () => {
    const iosView = renderPanel(
      { deviceClass: "ios", channel: "ios-safari", installed: false, instructionsVisible: true },
      { variant: "card", testIDPrefix: "more-install" }
    );
    expect(iosView.findTestId("more-install-install-button")).toHaveLength(1);
    expect(iosView.findTestId("more-install-instructions-modal")).toHaveLength(1);
    expect(iosView.findTestId("more-install-apk-download-button")).toHaveLength(0);
    expect(iosView.findTestId("more-install-modal-apk-button")).toHaveLength(0);

    const iosStandaloneView = renderPanel(
      { deviceClass: "ios", channel: "ios-safari", installed: true },
      { variant: "card", testIDPrefix: "more-install" }
    );
    expect(iosStandaloneView.instance.toJSON()).toBeNull();
  });

  it("exibe fluxo nativo no APK Android (oculto no login, atualização disponível e verificação manual)", () => {
    const nativeLogin = renderPanel(
      { isNativeApp: true, supported: false, installed: true, deviceClass: "android", channel: "native-app" },
      { variant: "compact", testIDPrefix: "login-install" }
    );
    expect(nativeLogin.instance.toJSON()).toBeNull();

    const nativeUpdate = renderPanel(
      {
        isNativeApp: true,
        supported: false,
        installed: true,
        deviceClass: "android",
        channel: "native-app",
        installedVersion: "1.0.0",
        installedVersionCode: 1,
        updateAvailable: true,
      },
      { variant: "card", testIDPrefix: "more-install" }
    );
    expect(nativeUpdate.findTestId("more-install-apk-update-card")).toHaveLength(1);
    expect(nativeUpdate.findTestId("more-install-apk-update-button")).toHaveLength(1);

    const nativeUpToDate = renderPanel(
      {
        isNativeApp: true,
        supported: false,
        installed: true,
        deviceClass: "android",
        channel: "native-app",
        installedVersion: "1.4.0",
        installedVersionCode: 4,
        updateAvailable: false,
        updateCheckStatus: "up-to-date",
      },
      { variant: "card", testIDPrefix: "more-install" }
    );
    expect(nativeUpToDate.findTestId("more-install-apk-version-card")).toHaveLength(1);
    expect(nativeUpToDate.findTestId("more-install-check-updates-button")).toHaveLength(1);
    expect(nativeUpToDate.findTestId("more-install-apk-uptodate-text")).toHaveLength(1);
  });
});
