import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { buildGradualBlurStack } from "./GradualBlur.types";
import { GradualBlur as NativeGradualBlur } from "./GradualBlur";
import { GradualBlur as WebGradualBlur } from "./GradualBlur.web";

jest.mock("react-native", () => {
  const React = require("react");
  return {
    AccessibilityInfo: {
      isReduceMotionEnabled: async () => false,
      addEventListener: () => ({ remove() {} }),
    },
    StyleSheet: {
      absoluteFillObject: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
      create: (styles: any) => styles,
    },
    View: ({ children, ...props }: any) => React.createElement("View", props, children),
  };
});

jest.mock("../../hooks/useReducedMotion", () => ({
  useReducedMotion: () => false,
}));

describe("GradualBlur", () => {
  it("constrói camadas progressivas de blur e máscara conforme React Bits", () => {
    const stack = buildGradualBlurStack({
      position: "bottom",
      strength: 2,
      layers: 8,
      curve: "bezier",
      exponential: true,
      opacity: 1,
      saturation: 1.15,
      tint: "rgba(16, 40, 32, 0.84)",
      duration: 0.3,
      easing: "ease-out",
    });

    expect(stack.steps).toHaveLength(8);
    expect(stack.wash).not.toBeNull();
    expect(stack.wash?.background).toBe("rgba(16, 40, 32, 0.84)");
    expect(String(stack.wash?.maskImage)).toContain("linear-gradient(to bottom");

    const radii = stack.steps.map((step) => {
      const match = String(step.backdropFilter).match(/blur\(calc\(([\d.]+)px/);
      return match ? Number(match[1]) : 0;
    });
    expect(radii[0]).toBeLessThan(radii[radii.length - 1]);
    expect(String(stack.steps[0].backdropFilter)).toContain("saturate(");
    expect(String(stack.steps[0].maskImage)).toContain("linear-gradient(to bottom, transparent 0.00%, black 12.50%)");
    expect(String(stack.steps[7].maskImage)).toContain("linear-gradient(to bottom, transparent 87.50%, black 100.00%)");
  });

  it("limita camadas entre 1 e 16 e omite wash quando tint é transparente", () => {
    const clampedHigh = buildGradualBlurStack({
      position: "top",
      strength: 1,
      layers: 30,
      curve: "linear",
      exponential: false,
      opacity: 0.9,
      saturation: 1,
      tint: "transparent",
      duration: 0.2,
      easing: "ease-out",
    });

    expect(clampedHigh.steps).toHaveLength(16);
    expect(clampedHigh.wash).toBeNull();
    expect(String(clampedHigh.steps[0].backdropFilter)).not.toContain("saturate(");
  });

  it("renderiza variante web sem bloquear interações de toque/clique", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <WebGradualBlur
          position="bottom"
          height={104}
          layers={6}
          tint="rgba(16, 40, 32, 0.84)"
          testID="mobile-tab-gradual-blur"
        />
      );
    });
    const tree = renderer.toJSON() as TestRenderer.ReactTestRendererJSON;

    expect(tree.type).toBe("div");
    expect(tree.props["data-testid"]).toBe("mobile-tab-gradual-blur");
    expect(tree.props["aria-hidden"]).toBe("true");
    expect(tree.props.style.pointerEvents).toBe("none");
    expect(tree.props.style.height).toBe("104px");
    expect(tree.props.style.bottom).toBe(0);
    // 6 blur layers + 1 wash layer
    expect(tree.children).toHaveLength(7);
  });

  it("renderiza fallback nativo com camadas progressivas e pointerEvents none", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <NativeGradualBlur
          position="bottom"
          height={104}
          layers={5}
          tint="rgba(16, 40, 32, 0.84)"
          testID="mobile-tab-gradual-blur"
        />
      );
    });
    const tree = renderer.toJSON() as TestRenderer.ReactTestRendererJSON;

    expect(tree.type).toBe("View");
    expect(tree.props.pointerEvents).toBe("none");
    expect(tree.props.testID).toBe("mobile-tab-gradual-blur");
    expect(tree.children).toHaveLength(5);
  });
});
