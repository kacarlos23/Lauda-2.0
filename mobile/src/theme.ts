import { Platform } from "react-native";

export const colors = {
  background: "#F8FAF7",
  surface: "#FFFFFF",
  surfaceMuted: "#EEF5F1",
  ink: "#10201A",
  text: "#33423B",
  muted: "#748179",
  line: "#E2EAE5",
  primary: "#157A6E",
  primaryDark: "#0E4F49",
  primarySoft: "#DDF4EF",
  accent: "#F26B4F",
  accentSoft: "#FFE8E1",
  secondary: "#76B041",
  secondarySoft: "#EAF6DD",
  warning: "#F4B740",
  warningSoft: "#FFF4D9",
  danger: "#D64545",
  dangerSoft: "#FFE5E5",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const screen = {
  maxWidth: "75%" as const,
  listMaxWidth: "75%" as const,
};

export const shadow = Platform.select({
  web: {
    boxShadow: "0 10px 24px rgba(16, 32, 26, 0.08)",
  },
  ios: {
    shadowColor: "#10201A",
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  android: {
    elevation: 2,
  },
  default: {
    shadowColor: "#10201A",
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
});

export const buttonShadow = Platform.select({
  web: {
    boxShadow: "0 8px 18px rgba(14, 79, 73, 0.16)",
  },
  ios: {
    shadowColor: "#0E4F49",
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  android: {
    elevation: 3,
  },
  default: {
    shadowColor: "#0E4F49",
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
});
