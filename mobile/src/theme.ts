import { Platform } from "react-native";
export { fontSizes } from "./tokens/primitives";
export { printTheme } from "./tokens/print";

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
  white: "#FFFFFF",
  primarySoftBorder: "#BFE7DE",
  inverseSubtle: "#D7E2DC",
  inverseMuted: "#AFC0B8",
  inverseText: "#C6D2CC",
  inverseMeta: "#93A79E",
  inverseFaint: "#82998E",
  inverseBorderText: "#B7C6BF",
  dangerOnDark: "#E7A28F",
  dangerSurfaceStrong: "#F7E1E1",
  warningHighlight: "#FCEBAA",
  warningStrong: "#8C6A00",
  warningToast: "#7A5410",
  warningTextStrong: "#6E4813",
};

export const overlays = {
  subtleInverse: "rgba(248, 250, 246, 0.07)",
  inverseBorder: "rgba(248, 250, 246, 0.12)",
  inverseControlBorder: "rgba(248, 250, 246, 0.18)",
  inverseAvatarBorder: "rgba(248, 250, 246, 0.2)",
  inverseIconBorder: "rgba(248, 250, 246, 0.24)",
  inverseIconSurface: "rgba(248, 250, 246, 0.08)",
  mobileTabSelection: "rgba(255, 253, 248, 0.14)",
  activeNavigation: "rgba(31, 111, 85, 0.38)",
  dangerSurface: "rgba(183, 71, 58, 0.12)",
  modal: "rgba(16, 32, 26, 0.46)",
  modalStrong: "rgba(16, 32, 26, 0.56)",
  modalSoft: "rgba(16, 32, 26, 0.28)",
  modalWarm: "rgba(16, 32, 26, 0.38)",
  modalBrand: "rgba(16, 40, 32, 0.46)",
  modalCool: "rgba(15, 23, 42, 0.46)",
  modalNeutral: "rgba(23, 33, 26, 0.42)",
} as const;

export const spacing = {
  xxs: 2,
  micro: 3,
  xs: 4,
  sm: 8,
  control: 10,
  md: 12,
  dense: 14,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  xxxxl: 56,
};

export const radii = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  pill: 999,
};

export const radiusValues = {
  r2: 2,
  r3: 3,
  r4: 4,
  r5: 5,
  r6: 6,
  r8: 8,
  r12: 12,
  r13: 13,
  r14: 14,
  r16: 16,
  r17: 17,
  r18: 18,
  r19: 19,
  r20: 20,
  r22: 22,
  r26: 26,
  r46: 46,
} as const;

export const lineHeights = {
  h14: 14,
  h15: 15,
  h17: 17,
  h18: 18,
  h19: 19,
  h20: 20,
  h21: 21,
  h22: 22,
  h23: 23,
  h24: 24,
  h26: 26,
  h28: 28,
  h33: 33,
  h34: 34,
  h36: 36,
  h38: 38,
  h40: 40,
  h42: 42,
} as const;

export const fontWeights = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
  black: "900",
} as const;

export const fontFamilies = {
  monospace: Platform.select({ ios: "Menlo", android: "monospace", web: "monospace" }),
} as const;

export const iconSizes = {
  s13: 13,
  s14: 14,
  s15: 15,
  s16: 16,
  s17: 17,
  s18: 18,
  s19: 19,
  s20: 20,
  s21: 21,
  s22: 22,
  s23: 23,
  s24: 24,
  s26: 26,
  s28: 28,
  s30: 30,
  s38: 38,
} as const;

export const controlSizes = {
  compact: 36,
  medium: 40,
  default: 44,
  large: 48,
  tabBar: 72,
} as const;

export const breakpoints = {
  formCompact: 700,
  mobile: 768,
  adminCompact: 900,
  desktop: 1024,
} as const;

export const motion = {
  resizeDebounceMs: 120,
  sidebarMs: 220,
  interactionMs: 160,
  navigationSelectionMs: 220,
  sheetOpenMs: 300,
  sheetCloseMs: 250,
  reducedMs: 0.01,
} as const;

export const zIndices = {
  sticky: 10,
  sidebar: 20,
  tooltip: 40,
  toast: 100,
} as const;

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
  scheduleCardOffset: 58,
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
