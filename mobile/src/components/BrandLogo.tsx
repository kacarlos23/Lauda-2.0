import { Image, Platform, type ImageStyle, type StyleProp } from "react-native";

type BrandLogoProps = {
  variant?: "horizontal" | "symbol";
  tone?: "dark" | "light";
  width?: number;
  style?: StyleProp<ImageStyle>;
};

const nativeSources = {
  "horizontal-dark": require("../../assets/brand/png/lauda-logo-horizontal-600.png"),
  "horizontal-light": require("../../assets/brand/png/lauda-logo-horizontal-light-600.png"),
  "symbol-dark": require("../../assets/brand/png/lauda-symbol-512.png"),
  "symbol-light": require("../../assets/brand/png/lauda-symbol-light-512.png"),
} as const;

export function BrandLogo({
  variant = "horizontal",
  tone = "dark",
  width = variant === "horizontal" ? 152 : 36,
  style,
}: BrandLogoProps) {
  const key = `${variant}-${tone}` as keyof typeof nativeSources;
  const filename = variant === "horizontal"
    ? `lauda-logo-horizontal${tone === "light" ? "-light" : ""}.svg`
    : `lauda-symbol${tone === "light" ? "-light" : ""}.svg`;
  const height = variant === "horizontal" ? Math.round(width * 0.3) : width;

  return (
    <Image
      source={Platform.OS === "web" ? { uri: `/brand/${filename}` } : nativeSources[key]}
      style={[{ width, height }, style]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Lauda Ministério"
    />
  );
}
