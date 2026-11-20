import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text, TouchableOpacity, View } from "react-native";
import { SongThemeLabels } from "./SongThemeLabels";
import { SongTagList, SongTagPicker } from "./SongTagPicker";
import { Chip } from "../ui/Chip";
import { lightColors } from "../../theme";
import { darkColors } from "../../tokens/colorModes";
import { songThemeColors } from "../../tokens/songThemes";
import { SUGGESTED_SONG_TAGS } from "../../../../src/constants/songTags";

jest.mock("react-native", () => {
  const React = require("react");
  const component = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
  return {
    Platform: { OS: "web", select: (values: any) => values.web ?? values.default },
    StyleSheet: { create: (styles: any) => styles },
    Text: component("Text"), View: component("View"), TouchableOpacity: component("TouchableOpacity"),
  };
});
jest.mock("../ui/InputControl", () => ({ InputControl: () => null }));
jest.mock("../../store/themeStore", () => ({ useThemeStore: (selector: any) => selector({ mode: "light" }) }));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const flatten = (style: any): any => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const contrast = (ink: string, fill: string, background: string) => {
  const rgb = (hex: string) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  const alpha = fill.length === 9 ? parseInt(fill.slice(7), 16) / 255 : 1;
  const bg = rgb(background);
  const blended = rgb(fill).map((channel, i) => channel * alpha + bg[i] * (1 - alpha));
  const luminance = (channels: number[]) => channels.map((n) => {
    const value = n / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  const values = [luminance(rgb(ink)), luminance(blended)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

describe("song theme accessibility", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  const render = async (element: React.ReactElement) => {
    await act(async () => { renderer = TestRenderer.create(element); });
  };
  beforeAll(() => {
    const original = console.error;
    jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      if (!String(args[0]).includes("react-test-renderer is deprecated")) original(...args);
    });
  });
  afterEach(() => { if (renderer) act(() => renderer.unmount()); });
  afterAll(() => jest.restoreAllMocks());

  it("announces readonly labels as one phrase and hides individual texts", async () => {
    await render(<SongThemeLabels tags={["A", "B", "C", "D", "E"]} />);
    const group = renderer.root.findByType(View);
    expect(group.props.accessible).toBe(true);
    expect(group.props.accessibilityLabel).toBe("Temas: A, B, C, +2");
    for (const text of renderer.root.findAllByType(Text)) {
      expect(text.props.accessible).toBe(false);
      expect(text.props["aria-hidden"]).toBe(true);
      expect(text.props.accessibilityElementsHidden).toBe(true);
      expect(text.props.importantForAccessibility).toBe("no-hide-descendants");
    }
  });

  it("keeps the add action separate, with a 44px target and visible web focus", async () => {
    const onAdd = jest.fn();
    await render(<SongThemeLabels onAdd={onAdd} />);
    const button = renderer.root.findByType(TouchableOpacity);
    expect(renderer.root.findByType(View).props.accessible).toBe(false);
    expect(button.props.accessibilityRole).toBe("button");
    expect(button.props.accessibilityLabel).toBe("Adicionar tema");
    const style = flatten(button.props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
    expect(style.minHeight + 2 * button.props.hitSlop).toBeGreaterThanOrEqual(44);
    expect(style.minWidth).toBeGreaterThanOrEqual(44);
    expect(flatten(renderer.root.findByType(View).props.style).minHeight).toBeGreaterThanOrEqual(44);
    await act(async () => { button.props.onFocus(); button.props.onPress(); });
    expect(flatten(button.props.style).outlineWidth).toBe(2);
    expect(onAdd).toHaveBeenCalledTimes(1);
    await act(async () => button.props.onBlur());
    expect(flatten(button.props.style).outlineWidth).toBeUndefined();
    // No opacity animation is used, including when reduced motion is requested.
    expect(button.props.activeOpacity).toBe(1);
  });

  it("announces an empty readonly group without exposing a false button", async () => {
    await render(<SongThemeLabels />);
    expect(renderer.root.findByType(View).props.accessibilityLabel).toBe("Sem temas");
    expect(renderer.root.findAllByType(TouchableOpacity)).toHaveLength(0);
  });

  it("announces the limited tag list as one phrase", async () => {
    await render(<SongTagList tags={["A", "B", "C", "D"]} limit={2} />);
    const group = renderer.root.findByType(View);
    expect(group.props.accessible).toBe(true);
    expect(group.props.accessibilityLabel).toBe("Temas: A, B, +2");
    expect(renderer.root.findAllByType(Text).every((text) => text.props.accessibilityElementsHidden)).toBe(true);
  });

  it("exposes selected chips as removable buttons and preserves compact targets", async () => {
    const onChange = jest.fn();
    await render(<SongTagPicker selected={["Natal"]} onChange={onChange} allowCustom />);
    const chip = renderer.root.findAllByType(Chip).find((node) => node.props.label === "Natal")!;
    expect(chip.props.accessibilityRole).toBe("button");
    expect(chip.props.accessibilityLabel).toBe("Remover tema Natal");
    expect(chip.props.accessibilityState).toEqual({ selected: true });
    expect(flatten(chip.props.style).minHeight).toBeGreaterThanOrEqual(44);
    expect(flatten(chip.props.textStyle).lineHeight + 2 * flatten(chip.props.textStyle).borderWidth).toBe(26);
    expect(flatten(chip.props.style).minHeight + 2 * chip.props.hitSlop).toBeGreaterThanOrEqual(44);
    expect(flatten(chip.props.style).minWidth).toBeGreaterThanOrEqual(44);
    await act(async () => chip.props.onFocus());
    expect(flatten(chip.props.style).outlineWidth).toBe(2);
    await act(async () => chip.props.onPress());
    expect(onChange).toHaveBeenCalledWith([]);
    const add = renderer.root.findAllByType(TouchableOpacity).find((node) => node.props.testID === "song-tag-add")!;
    expect(add.props.accessibilityLabel).toBe("Adicionar tema");
    expect(flatten(add.props.style).minHeight + 2 * add.props.hitSlop).toBeGreaterThanOrEqual(44);
    await act(async () => add.props.onFocus());
    expect(flatten(add.props.style).outlineWidth).toBe(2);
  });

  it("uses text tokens with AA contrast on every theme fill in both palettes", async () => {
    await render(<SongThemeLabels tags={["Natal"]} />);
    expect(flatten(renderer.root.findByType(Text).props.style).color).toBe(lightColors.text);
    for (const dark of [false, true]) {
      const palette = dark ? { ...lightColors, ...darkColors } : lightColors;
      for (const background of [palette.surface, palette.surfaceMuted, palette.background]) {
        for (const tag of [...SUGGESTED_SONG_TAGS, "Tema personalizado"]) {
          expect(contrast(palette.text, songThemeColors(tag, dark).fill, background)).toBeGreaterThanOrEqual(4.5);
        }
        for (const fill of [palette.primarySoft, palette.surfaceMuted, palette.surface]) {
          expect(contrast(palette.text, fill, background)).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
});
