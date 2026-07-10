import { Platform } from "react-native";

export const colors = {
  background: "#F8FAF7",
  surface: "#FFFFFF",
  surfaceMuted: "#EEF5F1",
  ink: "#10201A",
  text: "#33423B",
  muted: "#5F6B64",
  line: "#E2EAE5",
  primary: "#157A6E",
  primaryDark: "#0E4F49",
  primarySoft: "#DDF4EF",
  success: "#2E7D32",
  successSoft: "#E3F4E6",
  info: "#2563A8",
  infoSoft: "#E4EEF9",
  neutral: "#475569",
  neutralSoft: "#EEF2F6",
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
  maxWidth: 900,
  listMaxWidth: 1200,
  contentBottomPadding: spacing.xxl,
};

export const typography = {
  screenTitle: {
    fontSize: 30,
    fontWeight: "800" as const,
    lineHeight: 36,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: "800" as const,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "400" as const,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    lineHeight: 24,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700" as const,
    lineHeight: 23,
  },
  body: {
    fontSize: 15,
    fontWeight: "400" as const,
    lineHeight: 22,
  },
  label: {
    fontSize: 13,
    fontWeight: "600" as const,
    lineHeight: 18,
  },
  metadata: {
    fontSize: 13,
    fontWeight: "400" as const,
    lineHeight: 18,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700" as const,
    lineHeight: 16,
  },
  badge: {
    fontSize: 11,
    fontWeight: "700" as const,
    lineHeight: 14,
  },
  error: {
    fontSize: 14,
    fontWeight: "600" as const,
    lineHeight: 20,
  },
  button: {
    fontSize: 14,
    fontWeight: "700" as const,
    lineHeight: 18,
  },
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
