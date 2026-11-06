import { runInNewContext } from "node:vm";
import { applyWebTheme, themeBootstrapScript, useThemeStore } from "./themeStore";
import { THEME_STORAGE_KEY, darkColors } from "../tokens/colorModes";

jest.mock("react-native", () => ({ Platform: { OS: "web", select: (values: any) => values.web ?? values.default } }));

describe("web theme preferences", () => {
  const originalWindow = (globalThis as any).window;
  const originalDocument = (globalThis as any).document;
  let media: { matches: boolean; addEventListener: jest.Mock; removeEventListener: jest.Mock };
  let storage: { getItem: jest.Mock; setItem: jest.Mock };
  let html: { style: { setProperty: jest.Mock; colorScheme: string }; dataset: Record<string, string> };
  beforeEach(() => {
    media = { matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() };
    storage = { getItem: jest.fn(() => null), setItem: jest.fn() };
    html = { style: { setProperty: jest.fn(), colorScheme: "" }, dataset: {} };
    Object.assign(globalThis, {
      document: { documentElement: html },
      window: { location: { href: "http://127.0.0.1:8094/" }, localStorage: storage, matchMedia: () => media, history: { state: {}, replaceState: jest.fn() } },
    });
    useThemeStore.setState({ preference: "system", mode: "light" });
  });
  afterAll(() => Object.assign(globalThis, { window: originalWindow, document: originalDocument }));

  it("applies a saved preference, persists changes and updates existing portal colors", () => {
    storage.getItem.mockReturnValue("dark");
    const cleanup = useThemeStore.getState().initialize();
    expect(html.dataset.colorMode).toBe("dark");
    expect(html.style.setProperty).toHaveBeenCalledWith("--lauda-color-surface", darkColors.surface);
    useThemeStore.getState().setPreference("light");
    expect(storage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, "light");
    expect(html.dataset.colorMode).toBe("light");
    cleanup();
    expect(media.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
  it("responds to system changes without overriding an explicit choice", () => {
    useThemeStore.getState().initialize();
    const listener = media.addEventListener.mock.calls[0][1];
    media.matches = true;
    listener();
    expect(useThemeStore.getState().mode).toBe("dark");
    useThemeStore.getState().setPreference("light");
    listener();
    expect(useThemeStore.getState().mode).toBe("light");
  });
  it("works when storage is blocked", () => {
    storage.getItem.mockImplementation(() => { throw new Error("blocked"); });
    storage.setItem.mockImplementation(() => { throw new Error("blocked"); });
    media.matches = true;
    useThemeStore.getState().initialize();
    expect(useThemeStore.getState().mode).toBe("dark");
    expect(() => useThemeStore.getState().setPreference("light")).not.toThrow();
  });
  it("preserves other URL parameters while changing the initial theme choice", () => {
    window.location.href = "http://127.0.0.1:8094/schedules/worship-order?date=2026-10-25&theme=dark";
    useThemeStore.getState().initialize();
    useThemeStore.getState().setPreference("light");
    expect(window.history.replaceState).toHaveBeenCalledWith({}, "", new URL("http://127.0.0.1:8094/schedules/worship-order?date=2026-10-25&theme=light"));
  });
  it.each(["dark", "system", "invalid"])("applies preference %s before first paint consistently with React", (saved) => {
    storage.getItem.mockReturnValue(saved);
    media.matches = true;
    runInNewContext(themeBootstrapScript(), { document, location: window.location, localStorage: storage, matchMedia: () => media, URL });
    const bootstrap = html.dataset.colorMode;
    useThemeStore.getState().initialize();
    expect(html.dataset.colorMode).toBe(bootstrap);
    expect(bootstrap).toBe("dark");
  });
  it("can resolve a theme before a document exists", () => {
    (globalThis as any).document = undefined;
    expect(applyWebTheme("system", true)).toBe("dark");
  });
});
