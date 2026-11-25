import React, { useMemo } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import {
  buildGradualBlurStack,
  GRADUAL_BLUR_DIRECTIONS,
  type GradualBlurPosition,
  type GradualBlurProps,
} from "./GradualBlur.types";

function parseLength(value: string | number | undefined, fallback: number): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (!Number.isNaN(parsed)) return value.endsWith("rem") ? parsed * 16 : parsed;
  }
  return fallback;
}

/**
 * Native fallback rendering stepped translucent edge layers when CSS backdrop-filter is unavailable.
 */
export function GradualBlur({
  position = "bottom",
  height = 96,
  width,
  strength = 2,
  layers = 8,
  curve = "linear",
  exponential = true,
  opacity = 1,
  saturation = 1,
  tint = "transparent",
  duration = 0.3,
  easing = "ease-out",
  zIndex = 1000,
  testID,
  style,
}: GradualBlurProps) {
  const edge: GradualBlurPosition = GRADUAL_BLUR_DIRECTIONS[position] ? position : "bottom";
  const vertical = edge === "top" || edge === "bottom";
  const depth = parseLength(vertical ? height : (width ?? height), 96);

  const { alphas } = useMemo(
    () =>
      buildGradualBlurStack({
        position: edge,
        strength,
        layers,
        curve,
        exponential,
        opacity,
        saturation,
        tint,
        duration,
        easing,
      }),
    [edge, strength, layers, curve, exponential, opacity, saturation, tint, duration, easing]
  );

  const rootStyle: ViewStyle = {
    position: "absolute",
    zIndex,
    top: edge === "bottom" ? undefined : 0,
    bottom: edge === "top" ? undefined : 0,
    left: edge === "right" ? undefined : 0,
    right: edge === "left" ? undefined : 0,
    height: vertical ? depth : undefined,
    width: vertical ? undefined : depth,
  };

  if (!tint || tint === "transparent") {
    return <View pointerEvents="none" accessible={false} style={[rootStyle, style as ViewStyle]} testID={testID} />;
  }

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[rootStyle, style as ViewStyle]}
      testID={testID}
    >
      {alphas.map((alpha, index) => {
        const startRatio = index / alphas.length;
        const insetValue = `${(startRatio * 100).toFixed(2)}%` as `${number}%`;
        const layerPosition: ViewStyle =
          edge === "bottom"
            ? { top: insetValue, bottom: 0, left: 0, right: 0 }
            : edge === "top"
              ? { top: 0, bottom: insetValue, left: 0, right: 0 }
              : edge === "right"
                ? { top: 0, bottom: 0, left: insetValue, right: 0 }
                : { top: 0, bottom: 0, left: 0, right: insetValue };
        return (
          <View
            key={index}
            style={[
              StyleSheet.absoluteFillObject,
              layerPosition,
              { backgroundColor: tint, opacity: (alpha / alphas.length) * opacity },
            ]}
          />
        );
      })}
    </View>
  );
}
