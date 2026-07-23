import { Platform } from "react-native";

export const tokens = {
  brand: {
    primary: "#1F6F55",
    deep: "#164C3C",
    ink: "#102820",
    accent: "#C0582D",
  },
  surface: {
    canvas: "#F4F2EC",
    base: "#FFFDF8",
    muted: "#EDF1EC",
    dark: "#102820",
  },
  text: {
    primary: "#13231D",
    secondary: "#63706A",
    inverse: "#F8FAF6",
  },
  border: {
    default: "#D9E0DB",
    strong: "#B9C6BF",
  },
  state: {
    success: "#2F7D54",
    warning: "#B7791F",
    danger: "#B7473A",
  },
} as const;

export const colors = {
  background: tokens.surface.canvas,
  surface: tokens.surface.base,
  surfaceMuted: tokens.surface.muted,
  surfaceDark: tokens.surface.dark,
  ink: tokens.text.primary,
  brandInk: tokens.brand.ink,
  text: tokens.text.primary,
  muted: tokens.text.secondary,
  inverse: tokens.text.inverse,
  line: tokens.border.default,
  lineStrong: tokens.border.strong,
  primary: tokens.brand.primary,
  primaryDark: tokens.brand.deep,
  primarySoft: "#E1ECE6",
  success: tokens.state.success,
  successSoft: "#E4EFE8",
  info: tokens.brand.deep,
  infoSoft: "#E4ECE8",
  neutral: "#53615B",
  neutralSoft: tokens.surface.muted,
  accent: tokens.brand.accent,
  accentText: "#B2522A",
  accentOnDark: "#E8875E",
  accentSoft: "#F4E4DB",
  secondary: tokens.brand.primary,
  secondarySoft: "#E1ECE6",
  warning: tokens.state.warning,
  warningSoft: "#F7ECD4",
  danger: tokens.state.danger,
  dangerSoft: "#F6E5E1",
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radii = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  pill: 999,
};

export const screen = {
  maxWidth: 1360,
  listMaxWidth: 1360,
  formMaxWidth: 720,
  sidebarWidth: 248,
  sidebarCollapsedWidth: 72,
  desktopPadding: 32,
  tabletPadding: 20,
  mobilePadding: 16,
  contentBottomPadding: spacing.xxl,
};

export const typography = {
  screenTitle: {
    fontSize: 34,
    fontWeight: "700" as const,
    lineHeight: 40,
    letterSpacing: -0.7,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: "700" as const,
    lineHeight: 42,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "400" as const,
    lineHeight: 21,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    lineHeight: 26,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    lineHeight: 24,
  },
  body: {
    fontSize: 14,
    fontWeight: "400" as const,
    lineHeight: 21,
  },
  label: {
    fontSize: 12,
    fontWeight: "600" as const,
    lineHeight: 17,
  },
  metadata: {
    fontSize: 12,
    fontWeight: "400" as const,
    lineHeight: 17,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700" as const,
    lineHeight: 15,
    letterSpacing: 0.7,
  },
  badge: {
    fontSize: 11,
    fontWeight: "700" as const,
    lineHeight: 14,
  },
  error: {
    fontSize: 13,
    fontWeight: "600" as const,
    lineHeight: 18,
  },
  button: {
    fontSize: 14,
    fontWeight: "600" as const,
    lineHeight: 18,
  },
  metric: {
    fontSize: 34,
    fontWeight: "700" as const,
    lineHeight: 38,
    letterSpacing: -0.8,
  },
};

export const shadow = Platform.select({
  web: {
    boxShadow: "0 14px 36px rgba(16, 40, 32, 0.14)",
  },
  ios: {
    shadowColor: tokens.brand.ink,
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
  },
  android: {
    elevation: 6,
  },
  default: {
    shadowColor: tokens.brand.ink,
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
  },
});

export const buttonShadow = Platform.select({
  web: { boxShadow: "none" },
  ios: { shadowOpacity: 0 },
  android: { elevation: 0 },
  default: { shadowOpacity: 0 },
});
