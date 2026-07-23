import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Alert, Text, TextInput, TouchableOpacity } from "react-native";
import SongsScreen from "../../app/(tabs)/songs";
import { musicService, SongsUnavailableClientError } from "../services/musicService";
import { useMusicStore } from "../store/musicStore";
import { Song } from "../types";

type TestNode = TestRenderer.ReactTestInstance;

const pushMock = jest.fn();
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
}));

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
  return { Check: Icon, ChevronDown: Icon, ChevronUp: Icon, Download: Icon, ExternalLink: Icon, FileText: Icon, Link: Icon, MicVocal: Icon, Plus: Icon, Search: Icon, Settings2: Icon, SlidersHorizontal: Icon, Square: Icon, UserRound: Icon, X: Icon };
});

jest.mock("../services/musicService", () => ({
  SongsUnavailableClientError: class SongsUnavailableClientError extends Error {
    songIds: string[];
    constructor(songIds: string[]) { super("Músicas indisponíveis"); this.songIds = songIds; }
  },
  musicService: {
    listSongs: jest.fn(),
    exportSongs: jest.fn(),
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
      .find((node: TestNode) => nodeText(node).includes("Próxima"));
    expect(nextButton).toBeTruthy();

    await act(async () => {
      nextButton!.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    const previousButton = renderer!.root.findAllByType(TouchableOpacity)
      .find((node: TestNode) => nodeText(node).includes("Anterior"));
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

  it("alterna o painel exatamente em 1000px de largura útil", async () => {
    await act(async () => {
      renderer = TestRenderer.create(<SongsScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const selectionButton = renderer!.root.findAllByType(TouchableOpacity)
      .find((node: TestNode) => node.props.accessibilityLabel === "Selecionar músicas para PDF");
    act(() => selectionButton!.props.onPress());

    const measured = renderer!.root.findByProps({ testID: "songs-content-width" });
    act(() => measured.props.onLayout({ nativeEvent: { layout: { width: 999 } } }));
    expect(renderer!.root.findAllByProps({ testID: "songs-selection-layout-compact" }).length).toBeGreaterThan(0);

    act(() => measured.props.onLayout({ nativeEvent: { layout: { width: 1000 } } }));
    expect(renderer!.root.findAllByProps({ testID: "songs-selection-layout-wide" }).length).toBeGreaterThan(0);
  });

  it("separa limpar seleção de cancelar o modo", async () => {
    await act(async () => {
      renderer = TestRenderer.create(<SongsScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const byLabel = (label: string) => renderer!.root.findAllByType(TouchableOpacity)
      .find((node: TestNode) => node.props.accessibilityLabel === label);
    act(() => byLabel("Selecionar músicas para PDF")!.props.onPress());
    act(() => renderer!.root.findByProps({ testID: "song-row-song-1" }).props.onPress());
    expect(renderer!.root.findAllByType(Text).some((node: TestNode) => nodeText(node).includes("1 música selecionada"))).toBe(true);

    act(() => byLabel("Limpar seleção de músicas")!.props.onPress());
    expect(renderer!.root.findAllByProps({ testID: "songs-export-panel" }).length).toBeGreaterThan(0);
    expect(renderer!.root.findAllByType(Text).some((node: TestNode) => nodeText(node).includes("0 músicas selecionadas"))).toBe(true);

    act(() => byLabel("Cancelar seleção de cifras")!.props.onPress());
    expect(renderer!.root.findAllByProps({ testID: "songs-export-panel" })).toHaveLength(0);
    expect(byLabel("Selecionar músicas para PDF")).toBeTruthy();
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
    act(() => byLabel("Selecionar músicas para PDF")!.props.onPress());
    act(() => renderer!.root.findByProps({ testID: "song-row-song-1" }).props.onPress());
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
    act(() => byLabel("Selecionar músicas para PDF")!.props.onPress());
    act(() => renderer!.root.findByProps({ testID: "song-row-song-1" }).props.onPress());

    jest.mocked(musicService.exportSongs).mockRejectedValueOnce(new Error("Falha temporária"));
    await act(async () => {
      renderer!.root.findAllByProps({ testID: "songs-export-button" }).at(-1)!.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(Alert.alert).toHaveBeenCalledWith("Erro", "Falha temporária");
    expect(renderer!.root.findAllByType(Text).some((node: TestNode) => nodeText(node).includes("1 música selecionada"))).toBe(true);

    jest.mocked(musicService.exportSongs).mockRejectedValueOnce(new SongsUnavailableClientError(["song-1"]));
    await act(async () => {
      renderer!.root.findAllByProps({ testID: "songs-export-button" }).at(-1)!.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(renderer!.root.findAllByType(Text).some((node: TestNode) => nodeText(node).includes("0 músicas selecionadas"))).toBe(true);
    expect(renderer!.root.findAllByProps({ testID: "feedback-toast" }).length).toBeGreaterThan(0);
  });
});
