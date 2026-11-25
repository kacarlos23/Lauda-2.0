import type { CSSProperties, RefObject } from "react";
import type { StyleProp, ViewStyle } from "react-native";

export type GradualBlurPosition = "top" | "bottom" | "left" | "right";
export type GradualBlurCurve = "linear" | "bezier" | "ease-in" | "ease-out" | "ease-in-out";

export interface GradualBlurProps {
  position?: GradualBlurPosition;
  target?: "parent" | "page";
  height?: string | number;
  width?: string | number;
  strength?: number;
  layers?: number;
  curve?: GradualBlurCurve;
  exponential?: boolean;
  opacity?: number;
  saturation?: number;
  tint?: string;
  autoHide?: boolean;
  container?: unknown | string | RefObject<unknown | null> | null;
  hoverIntensity?: number;
  duration?: number | string;
  easing?: string;
  zIndex?: number;
  testID?: string;
  style?: StyleProp<ViewStyle> | CSSProperties;
}

export const GRADUAL_BLUR_CURVES: Record<GradualBlurCurve, (t: number) => number> = {
  linear: (t) => t,
  bezier: (t) => t * t * (3 - 2 * t),
  "ease-in": (t) => t * t,
  "ease-out": (t) => 1 - (1 - t) * (1 - t),
  "ease-in-out": (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};

export const GRADUAL_BLUR_DIRECTIONS: Record<GradualBlurPosition, string> = {
  top: "to top",
  bottom: "to bottom",
  left: "to left",
  right: "to right",
};

export function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

export function toCssLength(value: string | number): string {
  return typeof value === "number" ? `${value}px` : value;
}

export function toCssTime(value: string | number): string {
  return typeof value === "number" ? `${value}s` : value;
}

export interface GradualBlurStackOptions {
  position: GradualBlurPosition;
  strength: number;
  layers: number;
  curve: GradualBlurCurve;
  exponential: boolean;
  opacity: number;
  saturation: number;
  tint: string;
  duration: number | string;
  easing: string;
}

export function buildGradualBlurStack({
  position,
  strength,
  layers,
  curve,
  exponential,
  opacity,
  saturation,
  tint,
  duration,
  easing,
}: GradualBlurStackOptions): { steps: CSSProperties[]; wash: CSSProperties | null; alphas: number[] } {
  const count = Math.min(Math.max(Math.round(layers) || 1, 1), 16);
  const shape = GRADUAL_BLUR_CURVES[curve] || GRADUAL_BLUR_CURVES.linear;
  const maxBlur = Math.max(strength, 0) * 12;
  const level = (u: number) => {
    const t = shape(clamp01(u));
    return maxBlur * (exponential ? (Math.pow(2, 4 * t) - 1) / 15 : t);
  };
  const boost = Math.pow(Math.max(saturation, 0), 1 / count);
  const fade = `${toCssTime(duration)} ${easing}`;
  const direction = GRADUAL_BLUR_DIRECTIONS[position] || GRADUAL_BLUR_DIRECTIONS.bottom;
  const steps: CSSProperties[] = [];
  const alphas: number[] = [];

  for (let i = 0; i < count; i++) {
    const from = level(i / count);
    const to = level((i + 1) / count);
    const radius = Math.sqrt(Math.max(to * to - from * from, 0));
    const filter = [
      `blur(calc(${radius.toFixed(3)}px * var(--gradual-blur-reveal, 1) * var(--gradual-blur-hover, 1)))`,
      boost !== 1 ? `saturate(calc(1 + ${(boost - 1).toFixed(4)} * var(--gradual-blur-reveal, 1)))` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const mask = `linear-gradient(${direction}, transparent ${((i / count) * 100).toFixed(2)}%, black ${(((i + 1) / count) * 100).toFixed(2)}%)`;

    steps.push({
      position: "absolute",
      inset: 0,
      borderRadius: "inherit",
      backdropFilter: filter,
      WebkitBackdropFilter: filter,
      maskImage: mask,
      WebkitMaskImage: mask,
      opacity,
      transition: `backdrop-filter ${fade}, -webkit-backdrop-filter ${fade}`,
    });

    const t = shape((i + 1) / count);
    alphas.push(t * t * t * (t * (t * 6 - 15) + 10));
  }

  const stopCount = Math.max(8, count);
  const stops = Array.from({ length: stopCount + 1 }, (_, k) => {
    const u = k / stopCount;
    const t = shape(u);
    const alpha = t * t * t * (t * (t * 6 - 15) + 10);
    return `hsl(0 0% 0% / ${alpha.toFixed(3)}) ${(u * 100).toFixed(1)}%`;
  }).join(", ");
  const tintMask = `linear-gradient(${direction}, ${stops})`;

  const wash: CSSProperties | null =
    tint && tint !== "transparent"
      ? {
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          background: tint,
          maskImage: tintMask,
          WebkitMaskImage: tintMask,
          opacity: "calc(var(--gradual-blur-reveal, 1) * min(var(--gradual-blur-hover, 1), 1))",
          transition: `opacity ${fade}`,
        }
      : null;

  return { steps, wash, alphas };
}
