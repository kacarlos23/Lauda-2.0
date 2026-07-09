import { Platform, type TextStyle } from "react-native";

export const colors = {
  background: "#F6F7F2",
  surface: "#FFFFFF",
  surfaceMuted: "#EEF1EA",
  ink: "#17211A",
  text: "#2D3A31",
  muted: "#667267",
  line: "#DDE4DA",
  primary: "#1F6F55",
  primaryDark: "#164C3C",
  primarySoft: "#DDEDE6",
  accent: "#C0582D",
  danger: "#B33131",
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
  sm: 8,
  md: 10,
  lg: 12,
  pill: 999,
};

export const screen = {
  maxWidth: 560,
  listMaxWidth: 720,
};

type WebInputResetStyle = TextStyle & {
  outline?: string;
  outlineStyle?: "none";
  outlineWidth?: number;
  outlineColor?: string;
  boxShadow?: string;
  WebkitAppearance?: "none";
};

export const inputReset =
  Platform.select<WebInputResetStyle>({
    web: {
      outline: "none",
      outlineStyle: "none",
      outlineWidth: 0,
      outlineColor: "transparent",
      boxShadow: "none",
      WebkitAppearance: "none",
    },
    default: {},
  }) ?? {};

export const shadow = Platform.select({
  web: {
    boxShadow: "0 8px 16px rgba(14, 27, 20, 0.08)",
  },
  ios: {
    shadowColor: "#0E1B14",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  android: {
    elevation: 2,
  },
  default: {
    shadowColor: "#0E1B14",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
});
