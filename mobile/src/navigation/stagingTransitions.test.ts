import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Animated } from "react-native";

const timingCalls: Array<{ value: unknown; config: { toValue: number; duration: number } }> = [];
const setValueCalls: Array<{ value: unknown; next: number }> = [];
let mockPathname = "/";
let mockReducedMotion = false;
let mockScreenWidth = 390;

jest.mock("react-native", () => {
  const ReactLib = require("react");
  const create = (type: string) => ({ children, ...props }: Record<string, unknown>) =>
    ReactLib.createElement(type, props, children as React.ReactNode);

  class MockAnimatedValue {
    current: number;
    constructor(initial: number) {
      this.current = initial;
    }
    setValue(next: number) {
      this.current = next;
      setValueCalls.push({ value: this, next });
    }
    stopAnimation() {}
    interpolate(config: {
      inputRange: number[];
      outputRange: number[];
      extrapolate?: string;
    }) {
      return {
        ...config,
        evaluate: (input: number) => {
          const { inputRange, outputRange } = config;
          if (input <= inputRange[0]) return outputRange[0];
          const last = inputRange.length - 1;
          if (input >= inputRange[last]) return outputRange[last];
          for (let index = 1; index < inputRange.length; index += 1) {
            if (input <= inputRange[index]) {
              const t =
                (input - inputRange[index - 1]) /
                (inputRange[index] - inputRange[index - 1]);
              return outputRange[index - 1] + t * (outputRange[index] - outputRange[index - 1]);
            }
          }
          return outputRange[last];
        },
      };
    }
  }

  return {
    Animated: {
      Value: MockAnimatedValue,
      View: create("AnimatedView"),
      timing: (value: MockAnimatedValue, config: { toValue: number; duration: number }) => {
        timingCalls.push({ value, config });
        return {
          start: (cb?: (result: { finished: boolean }) => void) => {
            value.current = config.toValue;
            cb?.({ finished: true });
          },
          stop: jest.fn(),
        };
      },
      parallel: (animations: Array<{ start: (cb?: () => void) => void; stop: () => void }>) => ({
        start: (cb?: () => void) => {
          animations.forEach((animation) => animation.start());
          cb?.();
        },
        stop: () => animations.forEach((animation) => animation.stop()),
      }),
    },
    Easing: {
      bezier: (...points: number[]) => ({ bezier: points }),
    },
    Platform: {
      OS: "web",
      select: (values: Record<string, unknown>) => values.web ?? values.default,
    },
    StyleSheet: {
      absoluteFill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
      create: <T extends Record<string, unknown>>(styles: T) => styles,
    },
    View: create("View"),
  };
});

jest.mock("expo-router", () => ({
  usePathname: () => mockPathname,
}));

jest.mock("../hooks/useReducedMotion", () => ({
  useReducedMotion: () => mockReducedMotion,
}));

jest.mock("../hooks/useResponsiveLayout", () => ({
  useResponsiveLayout: () => ({
    isMobile: true,
    isTablet: false,
    isDesktop: false,
    screenWidth: mockScreenWidth,
    screenHeight: 844,
  }),
}));

jest.mock("../store/authStore", () => ({
  useAuthStore: (selector: (state: { user: null }) => unknown) => selector({ user: null }),
}));

jest.mock("lucide-react-native", () => {
  const Icon = () => null;
  return {
    Building2: Icon,
    CalendarClock: Icon,
    Church: Icon,
    Ellipsis: Icon,
    Guitar: Icon,
    Home: Icon,
    Music2: Icon,
    Shield: Icon,
    User: Icon,
    UserCircle2: Icon,
    Users: Icon,
  };
});

import { StagingDockSurface } from "../components/StagingDockSurface";
import { stagingNavigationCss, stagingTransitionMs } from "../tokens/stagingNavigation";
import {
  STAGING_SCENE_INPUT_RANGE,
  STAGING_SCENE_OUTPUT_RANGE,
  stagingSceneStyleInterpolator,
  stagingScreenTransitionOptions,
} from "./stagingTransitions";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const originalConsoleError = console.error;

type InterpolatedValue = {
  inputRange: number[];
  outputRange: number[];
  extrapolate?: string;
  evaluate: (input: number) => number;
};

describe("transições da navegação de staging", () => {
  beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      if (String(args[0]).includes("react-test-renderer is deprecated")) return;
      originalConsoleError(...args);
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    timingCalls.length = 0;
    setValueCalls.length = 0;
    mockPathname = "/";
    mockReducedMotion = false;
    mockScreenWidth = 390;
  });

  it("configura cross-fade de 160ms apenas quando habilitado e sem reduzir movimento", () => {
    expect(stagingScreenTransitionOptions(false, false)).toEqual({ animation: "none" });
    expect(stagingScreenTransitionOptions(true, true)).toEqual({ animation: "none" });

    const enabled = stagingScreenTransitionOptions(true, false);
    expect("transitionSpec" in enabled).toBe(true);
    if ("transitionSpec" in enabled && enabled.transitionSpec) {
      expect(enabled.transitionSpec.animation).toBe("timing");
      expect(enabled.transitionSpec.config.duration).toBe(stagingTransitionMs.scene);
      expect(enabled.transitionSpec.config.duration).toBe(160);
      expect(enabled.sceneStyleInterpolator).toBe(stagingSceneStyleInterpolator);
    }
  });

  it("interpola opacidade côncava sem deslocamento geométrico do header", () => {
    const progress = new Animated.Value(0);
    const { sceneStyle } = stagingSceneStyleInterpolator({ current: { progress } });
    const opacity = sceneStyle.opacity as unknown as InterpolatedValue;

    expect(sceneStyle).not.toHaveProperty("transform");
    expect(opacity.inputRange).toEqual([...STAGING_SCENE_INPUT_RANGE]);
    expect(opacity.outputRange).toEqual([...STAGING_SCENE_OUTPUT_RANGE]);
    expect(opacity.extrapolate).toBe("clamp");
    expect(opacity.evaluate(-1)).toBe(0);
    expect(opacity.evaluate(-0.55)).toBeCloseTo(0.62);
    expect(opacity.evaluate(-0.25)).toBeCloseTo(0.92);
    expect(opacity.evaluate(0)).toBe(1);
    expect(opacity.evaluate(0.25)).toBeCloseTo(0.92);
    expect(opacity.evaluate(0.55)).toBeCloseTo(0.62);
    expect(opacity.evaluate(1)).toBe(0);
  });

  it("inclui regras CSS de transição rápida e respeita prefers-reduced-motion", () => {
    expect(stagingNavigationCss).toContain('[data-testid^="staging-dock-tab-"]');
    expect(stagingNavigationCss).toContain(`${stagingTransitionMs.dockButton}ms`);
    expect(stagingNavigationCss).toContain(`${stagingTransitionMs.dockPress}ms`);
    expect(stagingNavigationCss).toContain('div[data-testid="staging-indicator-sidebar"]');
    expect(stagingNavigationCss).toContain('div[data-testid="staging-desktop-content"]');
    expect(stagingNavigationCss).toContain(`${stagingTransitionMs.sidebarWidth}ms`);
    expect(stagingNavigationCss).toContain(`${stagingTransitionMs.sidebarItem}ms`);
    expect(stagingNavigationCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(stagingNavigationCss).toContain("transition-duration: 1ms !important;");
    expect(stagingNavigationCss).toContain("transform: none !important;");
  });

  it("desliza a pílula do dock móvel ao trocar de aba, ajusta em resize e encaixa sem animar em movimento reduzido", () => {
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(React.createElement(StagingDockSurface));
    });

    const surface = renderer.root.findByProps({ testID: "staging-dock-surface" });
    const indicator = renderer.root.findByProps({ testID: "staging-dock-indicator" });
    expect(surface).toBeDefined();
    expect(indicator).toBeDefined();

    const track = renderer.root.find((node) => typeof node.props.onLayout === "function");
    act(() => {
      track.props.onLayout({ nativeEvent: { layout: { width: 300, height: 50 } } });
    });

    timingCalls.length = 0;
    setValueCalls.length = 0;

    mockPathname = "/songs";
    act(() => {
      renderer.update(React.createElement(StagingDockSurface));
    });

    const slideCall = timingCalls.find(
      (call) => call.config.duration === stagingTransitionMs.dockIndicator
    );
    expect(slideCall).toBeDefined();
    expect(slideCall?.config.toValue).toBeCloseTo(150);

    timingCalls.length = 0;
    setValueCalls.length = 0;

    act(() => {
      track.props.onLayout({ nativeEvent: { layout: { width: 250, height: 50 } } });
    });

    expect(
      timingCalls.find((call) => call.config.duration === stagingTransitionMs.dockIndicator)
    ).toBeUndefined();
    expect(setValueCalls.some((call) => Math.abs(call.next - 125) < 0.01)).toBe(true);

    timingCalls.length = 0;
    setValueCalls.length = 0;
    mockReducedMotion = true;
    mockPathname = "/";
    act(() => {
      renderer.update(React.createElement(StagingDockSurface));
    });

    expect(timingCalls).toHaveLength(0);
    expect(setValueCalls.some((call) => call.next === 0)).toBe(true);

    act(() => {
      renderer.unmount();
    });
  });
});
