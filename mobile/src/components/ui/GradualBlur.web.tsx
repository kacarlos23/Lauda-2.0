import React, { useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties, type RefObject } from "react";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import {
  buildGradualBlurStack,
  clamp01,
  GRADUAL_BLUR_DIRECTIONS,
  toCssLength,
  type GradualBlurPosition,
  type GradualBlurProps,
} from "./GradualBlur.types";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function findScroller(
  container: GradualBlurProps["container"],
  root: HTMLElement,
  target: string,
  vertical: boolean
): Element | Window | null {
  if (container) {
    if (typeof container === "string") return document.querySelector(container);
    if (typeof container === "object" && "current" in container) {
      return (container as RefObject<Element | null>).current;
    }
    return container as Element;
  }
  if (target === "page") return window;
  const parent = root.parentElement;
  if (!parent) return null;
  const scrolls = (node: Element) => {
    const computed = getComputedStyle(node);
    return /(auto|scroll|overlay)/.test(vertical ? computed.overflowY : computed.overflowX);
  };
  const sibling = Array.from(parent.children).find((child) => child !== root && scrolls(child));
  return sibling || (scrolls(parent) ? parent : null);
}

/**
 * Progressive multi-layer edge blur adapted from React Bits (GradualBlur) for Expo Web.
 */
export function GradualBlur({
  position = "bottom",
  target = "parent",
  height = "6rem",
  width,
  strength = 2,
  layers = 8,
  curve = "linear",
  exponential = true,
  opacity = 1,
  saturation = 1,
  tint = "transparent",
  autoHide = false,
  container,
  hoverIntensity = 1,
  duration = 0.3,
  easing = "ease-out",
  zIndex = 1000,
  testID,
  style,
}: GradualBlurProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const edge: GradualBlurPosition = GRADUAL_BLUR_DIRECTIONS[position] ? position : "bottom";
  const vertical = edge === "top" || edge === "bottom";
  const effectiveDuration = reducedMotion ? 0 : duration;

  const stack = useMemo(
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
        duration: effectiveDuration,
        easing,
      }),
    [edge, strength, layers, curve, exponential, opacity, saturation, tint, effectiveDuration, easing]
  );

  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    if (!autoHide) {
      root.style.removeProperty("--gradual-blur-reveal");
      return undefined;
    }
    const scroller = findScroller(container, root, target, vertical);
    if (!scroller) return undefined;
    const element = scroller instanceof Element ? scroller : null;
    const start = edge === "top" || edge === "left";

    const update = () => {
      const page = document.documentElement;
      const offset = element
        ? vertical
          ? element.scrollTop
          : element.scrollLeft
        : vertical
          ? window.scrollY
          : window.scrollX;
      const limit = element
        ? vertical
          ? element.scrollHeight - element.clientHeight
          : element.scrollWidth - element.clientWidth
        : vertical
          ? page.scrollHeight - window.innerHeight
          : page.scrollWidth - window.innerWidth;
      const box = root.getBoundingClientRect();
      const reach = Math.max(vertical ? box.height : box.width, 1);
      const room = start ? offset : limit - offset;
      root.style.setProperty("--gradual-blur-reveal", clamp01(room / reach).toFixed(3));
    };

    update();
    const source = element ?? window;
    source.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const observer = element && typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (observer && element) {
      observer.observe(element);
      if (element.firstElementChild) observer.observe(element.firstElementChild);
    }
    return () => {
      source.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [autoHide, container, target, edge, vertical]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || hoverIntensity === 1) return undefined;
    let frame = 0;
    let inside = false;
    let point: { x: number; y: number } | null = null;

    const check = () => {
      frame = 0;
      if (!point) return;
      const box = root.getBoundingClientRect();
      const now = point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
      if (now === inside) return;
      inside = now;
      root.style.setProperty("--gradual-blur-hover", inside ? String(Math.max(hoverIntensity, 0)) : "1");
    };

    const onMove = (event: PointerEvent) => {
      point = { x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(check);
    };

    const onLeave = () => {
      point = null;
      inside = false;
      root.style.setProperty("--gradual-blur-hover", "1");
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      root.style.removeProperty("--gradual-blur-hover");
    };
  }, [hoverIntensity]);

  const depth = toCssLength(vertical ? height : (width ?? height));
  const span = vertical && width != null ? toCssLength(width) : null;
  const rounded = target !== "page" && !span;
  const corner = (a: GradualBlurPosition, b: GradualBlurPosition) =>
    rounded && (edge === a || edge === b) ? "inherit" : undefined;

  const rootStyle: CSSProperties = {
    position: target === "page" ? "fixed" : "absolute",
    pointerEvents: "none",
    zIndex,
    borderTopLeftRadius: corner("top", "left"),
    borderTopRightRadius: corner("top", "right"),
    borderBottomLeftRadius: corner("bottom", "left"),
    borderBottomRightRadius: corner("bottom", "right"),
    top: edge === "bottom" ? undefined : 0,
    bottom: edge === "top" ? undefined : 0,
    left: edge === "right" ? undefined : 0,
    right: edge === "left" ? undefined : 0,
    height: vertical ? depth : undefined,
    width: vertical ? (span ?? undefined) : depth,
    marginInline: span ? "auto" : undefined,
    ...(style as CSSProperties | undefined),
  };

  return (
    <div ref={rootRef} data-testid={testID} style={rootStyle} aria-hidden="true">
      {stack.steps.map((layerStyle, index) => (
        <div key={index} style={layerStyle} />
      ))}
      {stack.wash ? <div style={stack.wash} /> : null}
    </div>
  );
}
