export type ColorMode = "light" | "dark";
export type ThemePreference = ColorMode | "system";
export const THEME_STORAGE_KEY = "lauda_color_mode";
export const themePreviewEnabled = process.env.EXPO_PUBLIC_THEME_PREVIEW === "1";

// This palette changes color roles only. Layout, type, spacing and print tokens stay shared.
export const darkColors: Record<string, string> = {
  background: "#111713", surface: "#19211C", surfaceMuted: "#222D26", surfaceDark: "#102820",
  ink: "#E6ECE7", brandInk: "#102820", text: "#E6ECE7", muted: "#A5B2A9", inverse: "#F8FAF6",
  line: "#34423A", lineStrong: "#56685B", primary: "#82C9A4", primaryDark: "#A6D7BE",
  primarySoft: "#233D30", success: "#92D5A6", successSoft: "#203B2B", info: "#A6D7BE",
  infoSoft: "#22372C", neutral: "#B1BDB5", neutralSoft: "#222D26", instrumentChip: "#2A352D",
  accent: "#D98258", accentText: "#EDAA85", accentOnDark: "#EDAA85", accentSoft: "#3D2C23",
  secondary: "#82C9A4", secondarySoft: "#233D30", warning: "#E4BF75", warningSoft: "#3B3322",
  danger: "#F0A99B", dangerSoft: "#402B29", white: "#FFFFFF", primarySoftBorder: "#416951",
  inverseSubtle: "#D7E2DC", inverseMuted: "#AFC0B8", inverseText: "#C6D2CC", inverseMeta: "#AFC0B8",
  inverseFaint: "#A6B9AE", inverseBorderText: "#B7C6BF", dangerOnDark: "#F0A99B",
  dangerSurfaceStrong: "#4A2D2A", warningHighlight: "#4C3E24", warningStrong: "#E4BF75",
  warningToast: "#47391E", warningTextStrong: "#EFD29A", brandPanel: "#164C3C",
  momentActive: "#2D7857", momentText: "#A6D7BE", momentBorder: "#416951", momentSurface: "#222D26",
};

export const darkOverlays: Record<string, string> = {
  songHoverShadow: "rgba(0, 0, 0, 0.28)", modal: "rgba(0, 0, 0, 0.62)",
  modalStrong: "rgba(0, 0, 0, 0.72)", modalSoft: "rgba(0, 0, 0, 0.48)",
  modalWarm: "rgba(0, 0, 0, 0.58)", modalBrand: "rgba(0, 0, 0, 0.62)",
  modalCool: "rgba(0, 0, 0, 0.62)", modalNeutral: "rgba(0, 0, 0, 0.62)",
};

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function resolveColorMode(preference: ThemePreference, systemDark: boolean): ColorMode {
  return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}

export function themeVariable(group: string, key: string): string {
  return `--lauda-${group}-${key}`;
}

export function createThemeTokens<T extends Record<string, string>>(values: T, group: string, enabled: boolean): T {
  if (!enabled) return values;
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, `var(${themeVariable(group, key)}, ${value})`])) as T;
}
