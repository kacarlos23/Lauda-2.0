import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import SongsScreen from "../../app/(tabs)/songs";
import { SongBulkThemeEditor } from "../components/songs/SongBulkThemeEditor";
import { musicService, SongsUnavailableClientError } from "../services/musicService";
import { useMusicStore } from "../store/musicStore";
import { Song } from "../types";
import { colors, spacing } from "../theme";
jest.mock("../components/songs/SongDataTransferPanel", () => ({ SongDataTransferPanel: () => null }));

jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));

type TestNode = TestRenderer.ReactTestInstance;

const pushMock = jest.fn();
let mockBottomInset = 0;
const baseSong: Song = {
  id: "song-1",
  title: "Musica 1",
  normalizedTitle: "musica-1",
  composer: null,
  originalKey: "C",
  content: "[C]Letra",
  bpm: null,
  artistId: "artist-1",
  artist: { id: "artist-1", name: "Artista", imageUrl: null },
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

jest.mock("react-native", () => {
  const React = require("react");
  const create = (type: string) => ({ children, ...props }: any) => React.createElement(type, props, children);
  return {
    AccessibilityInfo: { announceForAccessibility: jest.fn() },
    ActivityIndicator: create("ActivityIndicator"),
    Animated: {
      Value: class { setValue() {} },
      View: create("AnimatedView"),
      timing: () => ({ start() {}, stop() {} }),
    },
    Easing: { out: (value: any) => value, cubic: (value: any) => value },
    Alert: { alert: jest.fn() },
    FlatList: ({ data, renderItem, ListHeaderComponent, ListEmptyComponent, ListFooterComponent, ...props }: any) => React.createElement(
      "FlatList",
      props,
      <>
        {typeof ListHeaderComponent === "function" ? <ListHeaderComponent /> : ListHeaderComponent}
        {data?.length ? data.map((item: any, index: number) => React.createElement(React.Fragment, { key: item.id ?? index }, renderItem({ item, index }))) : ListEmptyComponent}
        {typeof ListFooterComponent === "function" ? <ListFooterComponent /> : ListFooterComponent}
      </>
    ),
    Image: create("Image"),
    Modal: ({ children, visible, ...props }: any) => visible ? React.createElement("Modal", props, children) : null,
    Platform: { OS: "web", select: (values: any) => values.web ?? values.default },
    RefreshControl: create("RefreshControl"),
    ScrollView: ({ children, ...props }: any) => React.createElement("ScrollView", props, children),
    StyleSheet: { create: (styles: any) => styles },
    Text: create("Text"),
    TextInput: create("TextInput"),
    TouchableOpacity: create("TouchableOpacity"),
    useWindowDimensions: () => ({ width: 390, height: 844 }),
    View: create("View"),
  };
});

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children, ...props }: any) => React.createElement("SafeAreaView", props, children),
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: mockBottomInset }),
}));

jest.mock("../components/BottomSheet", () => ({
  BottomSheet: ({ isOpen, children, footer, ...props }: any) => isOpen
    ? React.createElement("BottomSheet", props, children, footer) : null,
}));

jest.mock("../hooks/useReducedMotion", () => ({ useReducedMotion: () => false }));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: pushMock }),
  useFocusEffect: (callback: () => void) => {
    const React = require("react");
    React.useEffect(callback, []);
  },
}));

jest.mock("lucide-react-native", () => {
  const React = require("react");
  const Icon = (props: any) => React.createElement("Icon", props);
  return { Check: Icon, ChevronDown: Icon, ChevronUp: Icon, Download: Icon, ExternalLink: Icon, FileText: Icon, Link: Icon, MicVocal: Icon, Plus: Icon, Search: Icon, Settings2: Icon, SlidersHorizontal: Icon, Square: Icon, Tag: Icon, UserRound: Icon, X: Icon };
});

jest.mock("../services/musicService", () => ({
  SongsUnavailableClientError: class SongsUnavailableClientError extends Error {
    songIds: string[];
    constructor(songIds: string[]) { super("Músicas indisponíveis"); this.songIds = songIds; }
  },
  musicService: {
    listSongs: jest.fn(),
    listSongTagCounts: jest.fn().mockResolvedValue({ items: [], untaggedCount: 40 }),
    exportSongs: jest.fn(),
    changeSongThemes: jest.fn(),
  },
}));

jest.mock("../store/authStore", () => ({
  useAuthStore: (selector: any) => selector({ user: { id: "user-1", role: "TENANT_ADMIN" } }),
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const originalConsoleError = console.error;

function nodeText(node: TestNode): string {
  return node.findAllByType(Text).map((text: TestNode) => text.props.children).flat().join(" ");
}

function flattenStyle(style: any): Record<string, any> {
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}

describe("SongsScreen pagination", () => {
  let renderer: TestRenderer.ReactTestRenderer | null = null;

  beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      if (String(args[0]).includes("react-test-renderer is deprecated")) return;
      originalConsoleError(...args);
    });
  });

  afterEach(() => {
    if (renderer) {
      act(() => {
        renderer!.unmount();
      });
      renderer = null;
    }
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockBottomInset = 0;
    useMusicStore.setState({
      songs: [],
      currentSong: null,
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      loading: false,
      refreshing: false,
      detailLoading: false,
      saving: false,
      error: null,
      detailError: null,
      requestedSongId: null,
      requestedListKey: null,
      currentSearch: "",
      currentPage: 1,
      currentFilters: {},
      lastFetchedAt: null,
      listMutationVersion: 0,
      listInvalidationVersion: 0,
      localMutations: {},
    });
    jest.mocked(musicService.listSongs).mockImplementation(async (_search = "", page = 1) => ({
      items: [{ ...baseSong, id: `song-${page}`, title: `Musica ${page}` }],
      pagination: { page, limit: 20, total: 40, totalPages: 2 },
    }));
  });

  it("exibe cadastro de música para administrador da igreja no mobile", async () => {
    await act(async () => {
      renderer = TestRenderer.create(<SongsScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const createButton = renderer!.root.findAllByType(TouchableOpacity)
      .find((node: TestNode) => node.props.accessibilityLabel === "Nova m\u00fasica");
    expect(createButton).toBeTruthy();

    act(() => {
      createButton!.props.onPress();
    });

    expect(pushMock).toHaveBeenCalledWith("/songs/new");
  });

  it("avanca e volta usando axios/service para carregar a pagina correta", async () => {
    await act(async () => {
      renderer = TestRenderer.create(<SongsScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const nextButton = renderer!.root.findAllByType(TouchableOpacity)
      .find((node: TestNode) => node.props.accessibilityLabel === "Próxima página");
    expect(nextButton).toBeTruthy();

    await act(async () => {
      nextButton!.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    const previousButton = renderer!.root.findAllByType(TouchableOpacity)
      .find((node: TestNode) => node.props.accessibilityLabel === "Página anterior");
    expect(previousButton).toBeTruthy();

    await act(async () => {
      previousButton!.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(musicService.listSongs).toHaveBeenCalledWith("", 1, 20, {}, expect.any(Object));
    expect(musicService.listSongs).toHaveBeenCalledWith("", 2, 20, {}, expect.any(Object));
    expect(jest.mocked(musicService.listSongs).mock.calls.at(-1)?.slice(0, 4)).toEqual(["", 1, 20, {}]);
  });

  it("busca por musica ou artista em tempo real enquanto o usuario digita", async () => {
    jest.useFakeTimers();
    try {
      await act(async () => {
        renderer = TestRenderer.create(<SongsScreen />);
        await Promise.resolve();
        await Promise.resolve();
      });

      const searchInput = renderer!.root.findByType(TextInput);
      act(() => {
        searchInput.props.onChangeText("Artista");
      });
      act(() => {
        jest.advanceTimersByTime(299);
      });
      expect(musicService.listSongs).not.toHaveBeenCalledWith("Artista", 1, 20, {}, expect.any(Object));

      await act(async () => {
        jest.advanceTimersByTime(1);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(musicService.listSongs).toHaveBeenCalledWith("Artista", 1, 20, {}, expect.any(Object));
    } finally {
      jest.useRealTimers();
    }
  });

  it("limpa o filtro pelo botao ao final do campo de pesquisa", async () => {
    await act(async () => {
      renderer = TestRenderer.create(<SongsScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const searchInput = renderer!.root.findByType(TextInput);
    act(() => {
      searchInput.props.onChangeText("Artista");
    });

    const clearButton = renderer!.root.findAllByType(TouchableOpacity)
      .find((node: TestNode) => node.props.accessibilityLabel === "Limpar pesquisa de músicas");
    expect(clearButton).toBeTruthy();

    act(() => {
      clearButton!.props.onPress();
    });

    expect(renderer!.root.findByType(TextInput).props.value).toBe("");
    expect(renderer!.root.findAllByType(TouchableOpacity)
      .some((node: TestNode) => node.props.accessibilityLabel === "Limpar pesquisa de músicas")).toBe(false);
  });

  it("exibe ponto entre artista, tom e BPM sem mostrar escape unicode", async () => {
    jest.mocked(musicService.listSongs).mockResolvedValueOnce({
      items: [{ ...baseSong, bpm: 120 }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    await act(async () => {
      renderer = TestRenderer.create(<SongsScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const metadata = renderer!.root.findAllByType(Text)
      .map((node: TestNode) => [node.props.children].flat(Infinity).join(""))
      .find((text) => text.includes("· Tom"));
    expect(metadata).toBe("Artista · Tom C · 120 BPM");
    expect(metadata).not.toContain("\\u00b7");
  });

  it("mantém os temas selecionados junto com o filtro Sem tema", async () => {
    jest.mocked(musicService.listSongTagCounts).mockResolvedValueOnce({
      items: [{ id: "natal", name: "Natal", count: 2 }], untaggedCount: 3,
    });
    await act(async () => {
      renderer = TestRenderer.create(<SongsScreen />);
    });
    const press = (label: string) => renderer!.root.findAllByType(TouchableOpacity)
      .find((node: TestNode) => node.props.accessibilityLabel === label)!.props.onPress();
    await act(async () => press("Natal, 2 músicas"));
    await act(async () => press("Sem tema, 3 músicas"));
    expect(musicService.listSongs).toHaveBeenLastCalledWith("", 1, 20, { tags: ["Natal"], untagged: true }, expect.any(Object));
  });

  it("separa limpar seleção de cancelar o modo", async () => {
    await act(async () => {
      renderer = TestRenderer.create(<SongsScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const byLabel = (label: string) => renderer!.root.findAllByType(TouchableOpacity)
      .find((node: TestNode) => node.props.accessibilityLabel === label);
    act(() => byLabel("Selecionar músicas")!.props.onPress());
    act(() => renderer!.root.findByProps({ testID: "song-row-control-song-1" }).props.onPress());
    expect(renderer!.root.findAllByType(Text).some((node: TestNode) => nodeText(node).includes("1 selecionada"))).toBe(true);

    act(() => byLabel("Limpar seleção de músicas")!.props.onPress());
    expect(renderer!.root.findAllByProps({ testID: "song-selection-bar" }).length).toBeGreaterThan(0);
    expect(renderer!.root.findAllByType(Text).some((node: TestNode) => nodeText(node).includes("0 selecionadas"))).toBe(true);

    act(() => byLabel("Cancelar seleção de 0 músicas")!.props.onPress());
    expect(renderer!.root.findAllByProps({ testID: "song-selection-bar" })).toHaveLength(0);
    expect(byLabel("Selecionar músicas")).toBeTruthy();
  });

  it("bloqueia cliques duplicados durante a exportação", async () => {
    let resolveExport!: () => void;
    jest.mocked(musicService.exportSongs).mockReturnValueOnce(new Promise<void>((resolve) => { resolveExport = resolve; }));
    await act(async () => {
      renderer = TestRenderer.create(<SongsScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const byLabel = (label: string) => renderer!.root.findAllByType(TouchableOpacity)
      .find((node: TestNode) => node.props.accessibilityLabel === label);
    act(() => byLabel("Selecionar músicas")!.props.onPress());
    act(() => renderer!.root.findByProps({ testID: "song-row-control-song-1" }).props.onPress());
    const exportButton = renderer!.root.findAllByProps({ testID: "songs-export-button" }).at(-1)!;

    act(() => {
      exportButton.props.onPress();
      exportButton.props.onPress();
    });
    expect(musicService.exportSongs).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveExport();
      await Promise.resolve();
    });
    expect(renderer!.root.findAllByProps({ testID: "feedback-toast" }).length).toBeGreaterThan(0);
  });

  it("remove somente cifras indisponíveis e preserva a seleção em erro genérico", async () => {
    await act(async () => {
      renderer = TestRenderer.create(<SongsScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });
    const byLabel = (label: string) => renderer!.root.findAllByType(TouchableOpacity)
      .find((node: TestNode) => node.props.accessibilityLabel === label);
    act(() => byLabel("Selecionar músicas")!.props.onPress());
    act(() => renderer!.root.findByProps({ testID: "song-row-control-song-1" }).props.onPress());

    jest.mocked(musicService.exportSongs).mockRejectedValueOnce(new Error("Falha temporária"));
    await act(async () => {
      renderer!.root.findAllByProps({ testID: "songs-export-button" }).at(-1)!.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(Alert.alert).not.toHaveBeenCalled();
    const toast = renderer!.root.findByProps({ testID: "feedback-toast" });
    expect(nodeText(toast)).toContain("Falha temporária");
    expect(toast.props.accessibilityLiveRegion).toBe("polite");
    expect(renderer!.root.findAllByType(Text).some((node: TestNode) => nodeText(node).includes("1 selecionada"))).toBe(true);

    jest.mocked(musicService.exportSongs).mockRejectedValueOnce(new SongsUnavailableClientError(["song-1"]));
    await act(async () => {
      renderer!.root.findAllByProps({ testID: "songs-export-button" }).at(-1)!.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(renderer!.root.findAllByType(Text).some((node: TestNode) => nodeText(node).includes("0 selecionadas"))).toBe(true);
    expect(renderer!.root.findAllByProps({ testID: "feedback-toast" }).length).toBeGreaterThan(0);
  });

  it.each([0, 34, 48])("respeita inset inferior %i e mantém folga no fim da lista ao selecionar", async (bottom) => {
    mockBottomInset = bottom;
    await act(async () => { renderer = TestRenderer.create(<SongsScreen />); });
    const scroll = () => renderer!.root.findByProps({ testID: "song-catalog-scroll" });
    const initialPadding = flattenStyle(scroll().props.contentContainerStyle).paddingBottom;
    act(() => renderer!.root.findAllByType(TouchableOpacity)
      .find((node) => node.props.accessibilityLabel === "Selecionar músicas")!.props.onPress());
    act(() => renderer!.root.findByProps({ testID: "song-row-control-song-1" }).props.onPress());

    const dock = renderer!.root.findByProps({ testID: "song-selection-dock" });
    expect(flattenStyle(dock.props.style).paddingBottom).toBe(Math.max(spacing.sm, bottom));
    expect(flattenStyle(scroll().props.contentContainerStyle).paddingBottom).toBe(initialPadding + Math.max(spacing.sm, bottom));
    const actions = renderer!.root.findAllByType(TouchableOpacity)
      .filter((node) => ["Adicionar tema a 1 música", "Remover tema de 1 música", "Exportar PDF de 1 música", "Cancelar seleção de 1 música"].includes(node.props.accessibilityLabel));
    expect(actions).toHaveLength(4);
    actions.forEach((node) => {
      expect(node.props.accessibilityRole).toBe("button");
      expect(flattenStyle(node.props.style).minHeight).toBeGreaterThanOrEqual(44);
      expect(flattenStyle(node.props.style).minWidth).toBeGreaterThanOrEqual(44);
    });
    act(() => actions[0].props.onFocus());
    expect(flattenStyle(actions[0].props.style).borderColor).toBe(colors.accent);
    const count = renderer!.root.findAllByType(Text).find((node) => node.props.children === "1 selecionada")!;
    expect(count.props.accessibilityLiveRegion).toBe("polite");
    expect(count.props["aria-live"]).toBe("polite");
    act(() => actions[3].props.onPress());
    expect(flattenStyle(scroll().props.contentContainerStyle).paddingBottom).toBe(initialPadding);
  });

  it("conta temas entre páginas e oferece remover apenas temas da seleção, sem nova consulta", async () => {
    jest.mocked(musicService.listSongs).mockImplementation(async (_search = "", page = 1) => ({
      items: [{ ...baseSong, id: `song-${page}`, tags: page === 1 ? ["Adoração", "Comunhão"] : ["adoração"] }],
      pagination: { page, limit: 20, total: 2, totalPages: 2 },
    }));
    jest.mocked(musicService.listSongTagCounts).mockResolvedValueOnce({
      items: [
        { id: "adoracao", name: "Adoração", count: 2 },
        { id: "comunhao", name: "Comunhão", count: 1 },
        { id: "natal", name: "Natal", count: 8 },
      ], untaggedCount: 0,
    });
    await act(async () => { renderer = TestRenderer.create(<SongsScreen />); });
    const press = (label: string) => renderer!.root.findAllByType(TouchableOpacity)
      .find((node) => node.props.accessibilityLabel === label)!.props.onPress();
    act(() => press("Selecionar músicas"));
    act(() => renderer!.root.findByProps({ testID: "song-row-control-song-1" }).props.onPress());
    await act(async () => press("Próxima página"));
    act(() => renderer!.root.findByProps({ testID: "song-row-control-song-2" }).props.onPress());
    const requests = jest.mocked(musicService.listSongTagCounts).mock.calls.length;
    act(() => press("Adicionar tema a 2 músicas"));
    const editor = () => renderer!.root.findByType(SongBulkThemeEditor);
    expect(editor().findAllByType(TouchableOpacity).map((node) => node.props.accessibilityLabel))
      .toEqual(expect.arrayContaining(["Adoração · 2 de 2", "Comunhão · 1 de 2", "Natal"]));
    act(() => editor().props.onClose());
    act(() => press("Remover tema de 2 músicas"));
    const choices = () => editor().findAllByType(TouchableOpacity)
      .filter((node) => node.props.accessibilityRole === "checkbox");
    expect(choices().map((node) => node.props.accessibilityLabel)).toEqual(expect.arrayContaining(["Adoração · 2 de 2", "Comunhão · 1 de 2"]));
    expect(choices()).toHaveLength(2);
    choices().forEach((node) => expect(flattenStyle(node.props.style).minHeight).toBeGreaterThanOrEqual(44));
    expect(musicService.listSongTagCounts).toHaveBeenCalledTimes(requests);

    act(() => press("Comunhão · 1 de 2"));
    jest.mocked(musicService.changeSongThemes).mockRejectedValueOnce(new Error("Falha ao remover tema"));
    await act(async () => press("Aplicar temas a 2 músicas"));
    expect(musicService.changeSongThemes).toHaveBeenCalledWith(["song-1", "song-2"], "remove", ["comunhao"], []);
    const error = renderer!.root.findAllByType(Text).find((node) => node.props.testID === "song-bulk-theme-error")!;
    expect(nodeText(error)).toContain("Falha ao remover tema");
    expect(error.props.accessibilityRole).toBe("alert");
    const liveNotice = editor().findAllByType(View).find((node) => node.props["aria-live"] === "polite")!;
    expect(liveNotice.props.accessibilityLiveRegion).toBe("polite");
    expect(nodeText(liveNotice)).toContain("Falha ao remover tema");
    expect(Alert.alert).not.toHaveBeenCalled();

    jest.mocked(musicService.changeSongThemes).mockResolvedValueOnce({
      items: [{ id: "song-1", tags: ["Adoração"] }, { id: "song-2", tags: ["adoração"] }], updated: 1,
    });
    await act(async () => press("Aplicar temas a 2 músicas"));
    expect(nodeText(renderer!.root.findByProps({ testID: "feedback-toast" }))).toContain("Temas atualizados em 1 música.");
    act(() => press("Remover tema de 2 músicas"));
    expect(choices().map((node) => node.props.accessibilityLabel)).toEqual(["Adoração · 2 de 2"]);
  });

  it("mostra remoção vazia quando as selecionadas não têm temas", async () => {
    jest.mocked(musicService.listSongTagCounts).mockResolvedValueOnce({
      items: [{ id: "natal", name: "Natal", count: 8 }], untaggedCount: 1,
    });
    await act(async () => { renderer = TestRenderer.create(<SongsScreen />); });
    const press = (label: string) => renderer!.root.findAllByType(TouchableOpacity)
      .find((node) => node.props.accessibilityLabel === label)!.props.onPress();
    act(() => press("Selecionar músicas"));
    act(() => renderer!.root.findByProps({ testID: "song-row-control-song-1" }).props.onPress());
    act(() => press("Remover tema de 1 música"));
    expect(renderer!.root.findAllByType(Text).some((node) => node.props.children === "Nenhum tema nas músicas selecionadas.")).toBe(true);
    expect(renderer!.root.findByType(SongBulkThemeEditor).findAllByType(TouchableOpacity)
      .filter((node) => node.props.accessibilityRole === "checkbox")).toHaveLength(0);
    const apply = renderer!.root.findAllByType(TouchableOpacity).find((node) => node.props.accessibilityLabel === "Aplicar temas a 1 música")!;
    expect(apply.props.accessibilityState.disabled).toBe(true);
  });
});
