import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text, TouchableOpacity } from "react-native";
import { SongForm } from "./SongForm";
import { musicService } from "../services/musicService";

type TestNode = TestRenderer.ReactTestInstance;

jest.mock("react-native", () => {
  const React = require("react");
  const create = (type: string) => ({ children, ...props }: any) => React.createElement(type, props, children);
  return {
    ActivityIndicator: create("ActivityIndicator"),
    Alert: { alert: jest.fn() },
    Modal: ({ visible, children, ...props }: any) => visible ? React.createElement("Modal", props, children) : null,
    Platform: { select: (values: any) => values.web ?? values.default },
    ScrollView: create("ScrollView"),
    StyleSheet: { create: (styles: any) => styles },
    Text: create("Text"),
    TextInput: create("TextInput"),
    TouchableOpacity: create("TouchableOpacity"),
    View: create("View"),
  };
});

jest.mock("expo-router", () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  useRouter: () => ({ replace: jest.fn() }),
}));

jest.mock("@react-navigation/native", () => ({
  usePreventRemove: jest.fn(),
}));

jest.mock("./AppBackButton", () => ({
  AppBackButton: () => null,
}));

jest.mock("./ArtistPicker", () => {
  const React = require("react");
  const { Text, TouchableOpacity } = require("react-native");
  return {
    ArtistPicker: ({ onSelect, onQueryChange }: any) => (
      <>
        <TouchableOpacity
          testID="artist-picker"
          onPress={() => {
            onQueryChange?.("Aline Barros");
            onSelect({ id: "artist-1", name: "Aline Barros", createdAt: "", updatedAt: "" });
          }}
        >
          <Text>Selecionar artista</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="artist-query-only" onPress={() => onQueryChange?.("Aline Barros")}>
          <Text>Digitar artista</Text>
        </TouchableOpacity>
      </>
    ),
  };
});

jest.mock("../services/musicService", () => ({
  musicService: {
    searchCifraClub: jest.fn(),
    importCifraClub: jest.fn(),
    listArtists: jest.fn(),
    createArtist: jest.fn(),
  },
}));

const mockedMusicService = musicService as jest.Mocked<typeof musicService>;
const originalConsoleError = console.error;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("SongForm Cifra Club import", () => {
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
  });

  it("exige ao menos artista ou título antes de buscar", async () => {
    const onSave = jest.fn().mockResolvedValue("song-1");
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<SongForm saving={false} onSave={onSave} backHref="/songs" />);
    });

    await act(async () => {
      renderer!.root.findByProps({ testID: "song-cifra-club-search-button" }).props.onPress();
    });

    expect(mockedMusicService.searchCifraClub).not.toHaveBeenCalled();
    expect(renderer!.root.findAllByType(Text).map((node: TestNode) => node.props.children).join(" "))
      .toContain("Informe o artista ou o nome da música antes de buscar no Cifra Club.");
  });

  it("busca somente pelo texto digitado no artista", async () => {
    mockedMusicService.searchCifraClub.mockResolvedValueOnce([]);
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<SongForm saving={false} onSave={jest.fn()} backHref="/songs" />);
    });

    act(() => renderer!.root.findByProps({ testID: "artist-query-only" }).props.onPress());
    await act(async () => renderer!.root.findByProps({ testID: "song-cifra-club-search-button" }).props.onPress());

    expect(mockedMusicService.searchCifraClub).toHaveBeenCalledWith({ artist: "Aline Barros" });
  });

  it("busca somente pelo nome da música", async () => {
    mockedMusicService.searchCifraClub.mockResolvedValueOnce([]);
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<SongForm saving={false} onSave={jest.fn()} backHref="/songs" />);
    });

    act(() => renderer!.root.findByProps({ testID: "song-title-input" }).props.onChangeText("Autor da Vida"));
    await act(async () => renderer!.root.findByProps({ testID: "song-cifra-club-search-button" }).props.onPress());

    expect(mockedMusicService.searchCifraClub).toHaveBeenCalledWith({ title: "Autor da Vida" });
  });

  it("lista resultados, mostra prévia e aplica tom, link e cifra no formulário", async () => {
    mockedMusicService.searchCifraClub.mockResolvedValueOnce([
      {
        title: "Autor da Vida",
        artist: "Aline Barros",
        url: "https://www.cifraclub.com.br/aline-barros/autor-da-vida/",
        originalKey: "F#",
      },
    ]);
    mockedMusicService.importCifraClub.mockResolvedValueOnce({
      title: "Autor da Vida",
      artist: "Aline Barros",
      originalKey: "F#",
      cifraUrl: "https://www.cifraclub.com.br/aline-barros/autor-da-vida/",
      content: "[Intro] F#\nF# Autor da vida",
      source: "page-fallback",
    });

    const onSave = jest.fn().mockResolvedValue("song-1");
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<SongForm saving={false} onSave={onSave} backHref="/songs" />);
    });

    await act(async () => {
      renderer!.root.findByProps({ testID: "artist-picker" }).props.onPress();
      renderer!.root.findByProps({ testID: "song-title-input" }).props.onChangeText("Autor da Vida");
    });

    await act(async () => {
      renderer!.root.findByProps({ testID: "song-cifra-club-search-button" }).props.onPress();
    });

    expect(mockedMusicService.searchCifraClub).toHaveBeenCalledWith({ artist: "Aline Barros", title: "Autor da Vida" });
    expect(renderer!.root.findAllByType(Text).map((node: TestNode) => node.props.children).join(" "))
      .toContain("Autor da Vida");

    await act(async () => {
      renderer!.root.findByProps({ accessibilityLabel: "Importar Autor da Vida de Aline Barros" }).props.onPress();
    });

    expect(mockedMusicService.importCifraClub).toHaveBeenCalledWith("https://www.cifraclub.com.br/aline-barros/autor-da-vida/");

    await act(async () => {
      renderer!.root.findAllByType(TouchableOpacity)
        .find((node: TestNode) => node.findAllByType(Text).some((text: TestNode) => text.props.children === "Usar esta cifra"))!
        .props.onPress();
    });

    expect(renderer!.root.findByProps({ testID: "song-chord-input" }).props.value).toBe("[Intro] F#\nF# Autor da vida");

    await act(async () => {
      renderer!.root.findByProps({ testID: "song-save-button" }).props.onPress();
    });

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: "Autor da Vida",
      artistId: "artist-1",
      originalKey: "F#",
      cifraUrl: "https://www.cifraclub.com.br/aline-barros/autor-da-vida/",
      content: "[Intro] F#\nF# Autor da vida",
    }));
  });

  it("cria e vincula o artista importado quando ele ainda não existe", async () => {
    mockedMusicService.searchCifraClub.mockResolvedValueOnce([
      { title: "Canção Nova", artist: "Novo Artista", url: "https://www.cifraclub.com.br/novo-artista/cancao-nova/" },
    ]);
    mockedMusicService.importCifraClub.mockResolvedValueOnce({
      title: "Canção Nova",
      artist: "Novo Artista",
      originalKey: "C",
      cifraUrl: "https://www.cifraclub.com.br/novo-artista/cancao-nova/",
      content: "[C]Canção nova",
      source: "page-fallback",
    });
    mockedMusicService.listArtists.mockResolvedValue({ items: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } });
    mockedMusicService.createArtist.mockResolvedValue({ id: "artist-new", name: "Novo Artista", imageUrl: null, createdAt: "", updatedAt: "" });
    const onSave = jest.fn().mockResolvedValue("song-new");
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<SongForm saving={false} onSave={onSave} backHref="/songs" />);
    });

    act(() => renderer!.root.findByProps({ testID: "song-title-input" }).props.onChangeText("Canção"));
    await act(async () => renderer!.root.findByProps({ testID: "song-cifra-club-search-button" }).props.onPress());
    await act(async () => renderer!.root.findByProps({ accessibilityLabel: "Importar Canção Nova de Novo Artista" }).props.onPress());
    await act(async () => renderer!.root.findAllByType(TouchableOpacity)
      .find((node: TestNode) => node.findAllByType(Text).some((text: TestNode) => text.props.children === "Usar esta cifra"))!
      .props.onPress());

    expect(mockedMusicService.createArtist).toHaveBeenCalledWith({ name: "Novo Artista" });
    await act(async () => renderer!.root.findByProps({ testID: "song-save-button" }).props.onPress());
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "Canção Nova", artistId: "artist-new" }));
  });
});
