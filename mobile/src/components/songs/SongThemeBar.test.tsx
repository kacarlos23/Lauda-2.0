import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { colors, controlSizes } from "../../theme";
import { SongThemeBar } from "./SongThemeBar";

jest.mock("react-native", () => {
  const React = require("react");
  const create = (type: string) => ({ children, ...props }: any) => React.createElement(type, props, children);
  return {
    Platform: { OS: "web", select: (values: any) => values.web ?? values.default },
    ScrollView: create("ScrollView"),
    StyleSheet: { create: (styles: any) => styles },
    Text: create("Text"),
    TouchableOpacity: create("TouchableOpacity"),
    View: create("View"),
  };
});

let mockReducedMotion = false;
jest.mock("../../hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReducedMotion }));
jest.mock("../../store/themeStore", () => ({ useThemeStore: (selector: any) => selector({ mode: "light" }) }));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("SongThemeBar", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  const onToggle = jest.fn();
  const counts = {
    items: [{ id: "natal", name: "Natal", count: 0 }, { id: "pascoa", name: "Páscoa", count: 2 }],
    untaggedCount: 0,
  };
  const props = { counts, selected: [] as string[], untagged: false, compact: true, onToggle };
  const chips = () => renderer.root.findAllByType(TouchableOpacity);
  const fade = (side: string) => renderer.root.findAllByType(View).find((node) => node.props.testID === `song-theme-fade-${side}`);
  const render = (overrides: Partial<React.ComponentProps<typeof SongThemeBar>> = {}) => {
    act(() => { renderer = TestRenderer.create(<SongThemeBar {...props} {...overrides} />); });
  };

  beforeAll(() => {
    const original = console.error;
    jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      if (!String(args[0]).includes("react-test-renderer is deprecated")) original(...args);
    });
  });

  beforeEach(() => {
    onToggle.mockClear();
    mockReducedMotion = false;
  });

  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
    jest.replaceProperty(Platform, "OS", "web");
  });

  afterAll(() => jest.restoreAllMocks());

  it.each([true, false])("oculta temas e Sem tema com zero músicas (compacto: %s)", (compact) => {
    render({ compact });
    expect(chips().map((node) => node.props.accessibilityLabel)).toEqual(["Tema Páscoa, 2 músicas, não selecionado"]);
    const list = compact ? renderer.root.findByType(ScrollView) : renderer.root.findByProps({ accessibilityRole: "toolbar" });
    expect(list.props.accessibilityLabel).toBe("Filtrar por tema");
  });

  it.each([true, false])("mantém opções zeradas selecionadas para desmarcar (compacto: %s)", (compact) => {
    render({ compact, selected: ["Natal"], untagged: true });
    const selectedChips = chips().filter((node) => node.props.accessibilityState.selected);
    expect(selectedChips.map((node) => node.props.accessibilityLabel)).toEqual([
      "Tema Natal, 0 músicas, selecionado",
      "Tema Sem tema, 0 músicas, selecionado",
    ]);
    for (const chip of selectedChips) {
      expect(chip.props["aria-pressed"]).toBe(true);
      act(() => chip.props.onPress());
    }
    expect(onToggle.mock.calls).toEqual([["Natal"], [null]]);
    act(() => renderer.update(<SongThemeBar {...props} compact={compact} />));
    expect(chips()).toHaveLength(1);
  });

  it("mantém a seleção quando a contagem passa de um para zero", () => {
    render({ counts: { ...counts, items: [{ id: "natal", name: "Natal", count: 1 }] }, selected: ["Natal"] });
    expect(chips()[0].props.accessibilityLabel).toBe("Tema Natal, 1 música, selecionado");
    act(() => renderer.update(<SongThemeBar {...props} selected={["Natal"]} />));
    expect(chips()[0].props.accessibilityLabel).toBe("Tema Natal, 0 músicas, selecionado");
  });

  it("exibe Sem tema com contagem positiva e estado não selecionado", () => {
    render({ counts: { items: [], untaggedCount: 1 } });
    expect(chips()[0].props.accessibilityLabel).toBe("Tema Sem tema, 1 música, não selecionado");
    expect(chips()[0].props.accessibilityState).toEqual({ selected: false });
    expect(chips()[0].props["aria-pressed"]).toBe(false);
  });

  it.each([true, false])("preserva apenas o cabeçalho com ação quando não há opções (compacto: %s)", (compact) => {
    const emptyCounts = { items: counts.items.slice(0, 1), untaggedCount: 0 };
    render({ compact, counts: emptyCounts, action: <Text>Selecionar músicas</Text> });
    expect(chips()).toHaveLength(0);
    expect(renderer.root.findAllByProps({ accessibilityLabel: "Filtrar por tema" })).toHaveLength(0);
    expect(renderer.root.findAllByType(Text).map((node) => node.props.children)).toEqual(["TEMAS", "Selecionar músicas"]);
    act(() => renderer.update(<SongThemeBar {...props} compact={compact} counts={emptyCounts} />));
    expect(renderer.toJSON()).toBeNull();
  });

  it("não renderiza uma faixa vazia enquanto as contagens não chegaram", () => {
    render({ counts: null });
    expect(renderer.toJSON()).toBeNull();
  });

  it("garante alvo de 44x44, foco no web e respeita movimento reduzido", () => {
    mockReducedMotion = true;
    render();
    const chip = chips()[0];
    expect(Object.assign({}, ...chip.props.style)).toMatchObject({ minWidth: controlSizes.default, minHeight: controlSizes.default });
    expect(controlSizes.default).toBeGreaterThanOrEqual(44);
    expect(chip.props.activeOpacity).toBe(1);
    act(() => chip.props.onFocus());
    expect(Object.assign({}, ...chips()[0].props.style)).toMatchObject({ outlineStyle: "solid", outlineWidth: 2, outlineColor: colors.primary });
    act(() => chips()[0].props.onBlur());
    expect(Object.assign({}, ...chips()[0].props.style)).not.toHaveProperty("outlineWidth");
  });

  it.each(["ios", "android"] as const)("mantém rótulo e seleção no %s sem role exclusivo do web", (os) => {
    jest.replaceProperty(Platform, "OS", os);
    render({ selected: ["Natal"] });
    expect(renderer.root.findByType(ScrollView).props.accessibilityLabel).toBe("Filtrar por tema");
    expect(renderer.root.findByType(ScrollView).props.accessibilityRole).toBeUndefined();
    expect(chips()[0].props.accessibilityRole).toBe("button");
    expect(chips()[0].props.accessibilityState).toEqual({ selected: true });
    expect(chips()[0].props["aria-pressed"]).toBeUndefined();
  });

  it("mostra fades apenas nas bordas com conteúdo oculto e não bloqueia toques", () => {
    render();
    const scroll = renderer.root.findByType(ScrollView);
    expect(fade("left")).toBeUndefined();
    expect(fade("right")).toBeUndefined();
    act(() => {
      scroll.props.onLayout({ nativeEvent: { layout: { width: 100 } } });
      scroll.props.onContentSizeChange(100, 44);
    });
    expect(fade("right")).toBeUndefined();
    act(() => scroll.props.onContentSizeChange(300, 44));
    expect(fade("left")).toBeUndefined();
    expect(fade("right")?.props.pointerEvents).toBe("none");
    expect(fade("right")?.props["aria-hidden"]).toBe(true);
    act(() => scroll.props.onScroll({ nativeEvent: { contentOffset: { x: 50 } } }));
    expect(fade("left")?.props.pointerEvents).toBe("none");
    expect(fade("right")).toBeDefined();
    act(() => scroll.props.onScroll({ nativeEvent: { contentOffset: { x: 200 } } }));
    expect(fade("left")).toBeDefined();
    expect(fade("right")).toBeUndefined();
    act(() => scroll.props.onLayout({ nativeEvent: { layout: { width: 400 } } }));
    expect(fade("left")).toBeUndefined();
    expect(fade("right")).toBeUndefined();
    act(() => {
      scroll.props.onLayout({ nativeEvent: { layout: { width: 100 } } });
      scroll.props.onContentSizeChange(80, 44);
    });
    expect(fade("left")).toBeUndefined();
    expect(fade("right")).toBeUndefined();
  });
});
