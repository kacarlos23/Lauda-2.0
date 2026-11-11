import React, { useState } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AccessibilityInfo, Animated, Platform, Text, TouchableOpacity } from "react-native";
import { SongQuickThemeEditor } from "./SongQuickThemeEditor";
import { SongListRow } from "./SongListRow";
import { SongThemeChecklist } from "./SongThemeMenu";
import { musicService, SongThemeChange } from "../../services/musicService";
import { Song } from "../../types";

jest.mock("react-native", () => {
  const React = require("react");
  const component = (name: string) => React.forwardRef(({ children, ...props }: any, ref: any) => React.createElement(name, { ...props, ref }, children));
  const timing = jest.fn((value: any, config: any) => {
    let timer: ReturnType<typeof setTimeout>;
    return {
      start: (done?: (result: { finished: boolean }) => void) => {
        timer = setTimeout(() => { value.setValue(config.toValue); done?.({ finished: true }); }, config.duration);
      },
      stop: () => clearTimeout(timer),
    };
  });
  return {
    AccessibilityInfo: {
      isReduceMotionEnabled: jest.fn().mockResolvedValue(false),
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      setAccessibilityFocus: jest.fn(),
    },
    findNodeHandle: jest.fn((node: any) => node.handle),
    Animated: {
      Value: class { value: number; constructor(value: number) { this.value = value; } setValue(value: number) { this.value = value; } interpolate() { return 0; } },
      View: component("AnimatedView"), timing,
      parallel: (animations: any[]) => ({
        start: (done?: (result: { finished: boolean }) => void) => {
          let remaining = animations.length;
          animations.forEach((animation) => animation.start(() => { if (--remaining === 0) done?.({ finished: true }); }));
        },
        stop: () => animations.forEach((animation) => animation.stop()),
      }),
      spring: timing,
    },
    Dimensions: { get: () => ({ width: 1200, height: 900 }) },
    PanResponder: { create: () => ({ panHandlers: {} }) },
    Platform: { OS: "web", select: (values: any) => values.web ?? values.default },
    Modal: ({ children, visible, onShow }: any) => {
      React.useEffect(() => { if (visible) onShow?.(); }, [visible]);
      return visible ? React.createElement("Modal", null, children) : null;
    },
    Image: component("Image"), Pressable: component("Pressable"), ScrollView: component("ScrollView"),
    StyleSheet: { create: (styles: any) => styles, absoluteFillObject: {}, absoluteFill: {} },
    Text: component("Text"), TextInput: component("TextInput"), TouchableOpacity: component("TouchableOpacity"), View: component("View"),
    useWindowDimensions: () => ({ width: 1200, height: 900 }),
  };
});
jest.mock("lucide-react-native", () => ({ Check: () => null, Tag: () => null, UserRound: () => null, X: () => null, ArrowLeft: () => null }));
jest.mock("../../store/themeStore", () => ({ useThemeStore: (selector: any) => selector({ mode: "light" }) }));
jest.mock("../../services/musicService", () => ({ musicService: { changeSongTheme: jest.fn() } }));
jest.mock("../SongLinkButtons", () => ({ hasSongLinks: () => false, SongLinkButtons: () => null }));
jest.mock("../ui", () => ({ Button: jest.requireActual("../ui/Button").Button }));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const song: Song = {
  id: "song-1", title: "Canção", normalizedTitle: "cancao", originalKey: "C", content: "Letra",
  artistId: "artist-1", artist: { id: "artist-1", name: "Artista", imageUrl: null },
  createdAt: "2026-01-01", updatedAt: "2026-01-01", tags: ["Natal"],
};
const anchor = { x: 100, y: 100, width: 32, height: 32 };

describe("edição rápida de temas", () => {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  let keyboard: EventTarget;
  let addListener: jest.Mock;
  let removeListener: jest.Mock;
  const controls = new Map<string, { focus: jest.Mock; measureInWindow: jest.Mock; handle: number }>();
  const onClose = jest.fn();
  const onSaved = jest.fn();
  const onPreview = jest.fn();
  const onError = jest.fn();
  const originalDocument = globalThis.document;
  const originalFrame = globalThis.requestAnimationFrame;
  const originalCancelFrame = globalThis.cancelAnimationFrame;

  const editor = (position: typeof anchor | null = anchor) => <SongQuickThemeEditor song={song} anchor={position} knownNames={[]}
    onClose={onClose} onSaved={onSaved} onPreview={onPreview} onError={onError} />;
  const render = async (element: React.ReactElement = editor()) => {
    await act(async () => {
      renderer = TestRenderer.create(element, {
        createNodeMock: (element) => {
          const label = (element.props as { accessibilityLabel: string }).accessibilityLabel;
          if (!controls.has(label)) controls.set(label, {
            focus: jest.fn(), handle: controls.size + 1,
            measureInWindow: jest.fn((callback) => callback(100, 100, 32, 32)),
          });
          return controls.get(label);
        },
      });
    });
  };
  const advance = (milliseconds = 180) => act(() => jest.advanceTimersByTime(milliseconds));
  const escape = () => act(() => { keyboard.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: "Escape" })); });
  const text = (value: string) => renderer!.root.findAllByType(Text).find((node) => node.props.children === value);
  const option = (name: string) => renderer!.root.findAllByType(TouchableOpacity).find((node) => node.props.accessibilityLabel === name)!;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    controls.clear();
    (Platform as any).OS = "web";
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
    keyboard = new EventTarget();
    addListener = jest.fn(keyboard.addEventListener.bind(keyboard));
    removeListener = jest.fn(keyboard.removeEventListener.bind(keyboard));
    Object.defineProperty(globalThis, "document", { configurable: true, value: { addEventListener: addListener, removeEventListener: removeListener } });
    globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 16) as unknown as number;
    globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  });
  afterEach(() => {
    if (renderer) act(() => renderer!.unmount());
    renderer = undefined;
    jest.useRealTimers();
    Object.defineProperty(globalThis, "document", { configurable: true, value: originalDocument });
    globalThis.requestAnimationFrame = originalFrame;
    globalThis.cancelAnimationFrame = originalCancelFrame;
  });
  beforeAll(() => {
    const originalError = console.error;
    jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      if (!String(args[0]).includes("react-test-renderer is deprecated")) originalError(...args);
    });
  });
  afterAll(() => jest.restoreAllMocks());

  it.each([anchor, null])("Esc fecha e remove o listener no web (âncora %j)", async (position) => {
    await render(editor(position));
    advance();
    expect(addListener).toHaveBeenCalledWith("keydown", expect.any(Function), true);
    escape();
    expect(removeListener).toHaveBeenCalledWith("keydown", addListener.mock.calls[0][1], true);
    expect(onClose).not.toHaveBeenCalled();
    advance();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("remove o listener ao desmontar e ignora outras teclas", async () => {
    await render();
    act(() => { keyboard.dispatchEvent(Object.assign(new Event("keydown"), { key: "Enter" })); });
    advance();
    expect(onClose).not.toHaveBeenCalled();
    act(() => renderer!.unmount());
    renderer = undefined;
    expect(removeListener).toHaveBeenCalledWith("keydown", addListener.mock.calls[0][1], true);
    escape();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("mostra Salvando… até a resposta, bloqueia duplicatas e confirma os temas", async () => {
    let resolve!: (change: SongThemeChange) => void;
    jest.mocked(musicService.changeSongTheme).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    await render();
    const press = option("Natal").props.onPress;
    await act(async () => { press(); press(); });
    expect(text("Salvando…")?.props).toMatchObject({ accessibilityLiveRegion: "polite", "aria-live": "polite" });
    expect(option("Natal").props.disabled).toBe(true);
    expect(musicService.changeSongTheme).toHaveBeenCalledTimes(1);
    expect(onPreview).toHaveBeenCalledWith({ id: song.id, tags: [] });
    const saved = { id: song.id, tags: [] };
    await act(async () => resolve(saved));
    expect(text("Salvando…")).toBeUndefined();
    expect(option("Natal").props.accessibilityState.checked).toBe(false);
    expect(onSaved).toHaveBeenCalledWith(saved);
    expect(onPreview).toHaveBeenLastCalledWith(null);
  });

  it("exibe erro inline e restaura os temas anteriores quando salvar falha", async () => {
    let reject!: (reason: Error) => void;
    jest.mocked(musicService.changeSongTheme).mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
    await render();
    await act(async () => option("Natal").props.onPress());
    expect(option("Natal").props.accessibilityState.checked).toBe(false);
    await act(async () => reject(new Error("Falha ao salvar")));
    expect(text("Falha ao salvar")?.props.accessibilityRole).toBe("alert");
    expect(option("Natal").props.accessibilityState.checked).toBe(true);
    expect(option("Natal").props.disabled).toBe(false);
    expect(onError).toHaveBeenCalledWith("Falha ao salvar");
    expect(onSaved).not.toHaveBeenCalled();
    expect(onPreview).toHaveBeenLastCalledWith(null);
    expect(text("Salvando…")).toBeUndefined();
  });

  it("foca o primeiro checkbox e apresenta menu rotulado com alvos de 44 px", async () => {
    await render();
    const first = renderer!.root.findAllByType(TouchableOpacity).find((node) => node.props.accessibilityRole === "checkbox")!;
    expect(controls.get(first.props.accessibilityLabel)!.focus).toHaveBeenCalledTimes(1);
    expect(renderer!.root.findAllByProps({ accessibilityRole: "menu", accessibilityLabel: "Temas" }).length).toBeGreaterThan(0);
    expect(first.props.style[0]).toMatchObject({ minHeight: 44, minWidth: 44 });
    act(() => first.props.onFocus());
    expect(renderer!.root.findByType(SongThemeChecklist).findAllByType(TouchableOpacity)[0].props.style[1]).toBeTruthy();
  });

  function RowWithEditor({ empty = false }: { empty?: boolean }) {
    const [editing, setEditing] = useState(false);
    const [position, setPosition] = useState<typeof anchor | null>(null);
    const value = empty ? { ...song, tags: [] } : song;
    return <>
      <SongListRow song={value} selectionMode={false} selected={false} isLast editingThemes={editing}
        onPress={() => {}} onEditThemes={(next) => { setPosition(next); setEditing(true); }} />
      {editing ? <SongQuickThemeEditor song={value} anchor={position} knownNames={[]} onPreview={onPreview}
        onSaved={onSaved} onError={onError} onClose={() => setEditing(false)} /> : null}
    </>;
  }

  it.each([false, true])("devolve o foco ao botão de origem após Esc (+ tema: %s)", async (empty) => {
    await render(<RowWithEditor empty={empty} />);
    const label = empty ? "Adicionar tema a Canção" : "Editar temas de Canção";
    await act(async () => option(label).props.onPress());
    advance();
    escape();
    advance();
    advance(16);
    expect(controls.get(label)!.focus).toHaveBeenCalledTimes(1);
  });

  it("devolve o foco após toque fora", async () => {
    await render(<RowWithEditor />);
    await act(async () => option("Editar temas de Canção").props.onPress());
    advance();
    act(() => renderer!.root.findAllByProps({ testID: "song-theme-backdrop" })[0].props.onPress());
    advance();
    advance(16);
    expect(controls.get("Editar temas de Canção")!.focus).toHaveBeenCalledTimes(1);
  });

  it.each(["ios", "android"])("usa foco de acessibilidade e não registra teclado no %s", async (platform) => {
    (Platform as any).OS = platform;
    await render(<RowWithEditor />);
    await act(async () => option("Editar temas de Canção").props.onPress());
    expect(addListener).not.toHaveBeenCalled();
    const first = renderer!.root.findAllByType(TouchableOpacity).find((node) => node.props.accessibilityRole === "checkbox")!;
    expect(AccessibilityInfo.setAccessibilityFocus).toHaveBeenCalledWith(controls.get(first.props.accessibilityLabel)!.handle);
    advance();
    act(() => renderer!.root.findAllByProps({ accessibilityLabel: "Fechar" })[0].props.onPress());
    advance();
    advance(16);
    expect(AccessibilityInfo.setAccessibilityFocus).toHaveBeenLastCalledWith(controls.get("Editar temas de Canção")!.handle);
  });

  it.each([anchor, null])("fecha sem animação com reduzir movimento (âncora %j)", async (position) => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
    await render(editor(position));
    expect(Animated.timing).not.toHaveBeenCalled();
    escape();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(Animated.timing).not.toHaveBeenCalled();
  });

  it.each([anchor, null])("respeita reduzir movimento ativado com o menu aberto (âncora %j)", async (position) => {
    await render(editor(position));
    advance();
    const subscriptions = jest.mocked(AccessibilityInfo.addEventListener).mock.calls as unknown as [string, (enabled: boolean) => void][];
    const changeMotion = subscriptions.find(([event]) => event === "reduceMotionChanged")![1];
    act(() => changeMotion(true));
    jest.mocked(Animated.timing).mockClear();
    escape();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(Animated.timing).not.toHaveBeenCalled();
  });
});
