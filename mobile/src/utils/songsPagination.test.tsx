import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text, TouchableOpacity } from "react-native";
import SongsScreen from "../../app/(tabs)/songs";
import { musicService } from "../services/musicService";
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
    ScrollView: ({ children, ...props }: any) => React.createElement("ScrollView", props, children),
    StyleSheet: { create: (styles: any) => styles },
    Text: create("Text"),
    TextInput: create("TextInput"),
    TouchableOpacity: create("TouchableOpacity"),
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
  return { Check: Icon, Download: Icon, ExternalLink: Icon, FileText: Icon, Link: Icon, Plus: Icon, Settings2: Icon, SlidersHorizontal: Icon, Square: Icon, UserRound: Icon, X: Icon };
});

jest.mock("../services/musicService", () => ({
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

  it("avanca e volta usando axios/service para carregar a pagina correta", async () => {
    let renderer: TestRenderer.ReactTestRenderer;
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

    expect(musicService.listSongs).toHaveBeenCalledWith("", 1);
    expect(musicService.listSongs).toHaveBeenCalledWith("", 2);
    expect(jest.mocked(musicService.listSongs).mock.calls.at(-1)).toEqual(["", 1]);
  });
});
