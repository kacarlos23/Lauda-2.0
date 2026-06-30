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
    ArtistPicker: ({ onSelect }: any) => (
      <TouchableOpacity
        testID="artist-picker"
        onPress={() => onSelect({ id: "artist-1", name: "Aline Barros", createdAt: "", updatedAt: "" })}
      >
        <Text>Selecionar artista</Text>
      </TouchableOpacity>
    ),
  };
});

jest.mock("../services/musicService", () => ({
  musicService: {
    searchCifraClub: jest.fn(),
    importCifraClub: jest.fn(),
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

  it("exige artista e título antes de buscar", async () => {
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
      .toContain("Selecione o artista e informe o nome da música antes de buscar no Cifra Club.");
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

    expect(mockedMusicService.searchCifraClub).toHaveBeenCalledWith("Aline Barros", "Autor da Vida");
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
      originalKey: "F#",
      cifraUrl: "https://www.cifraclub.com.br/aline-barros/autor-da-vida/",
      content: "[Intro] F#\nF# Autor da vida",
    }));
  });
});
