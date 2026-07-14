import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text, TextInput } from "react-native";
import { ArtistPicker } from "./ArtistPicker";
import { musicService } from "../services/musicService";

type TestNode = TestRenderer.ReactTestInstance;

jest.mock("react-native", () => {
  const React = require("react");
  const create = (type: string) => ({ children, ...props }: any) => React.createElement(type, props, children);
  return {
    ActivityIndicator: create("ActivityIndicator"),
    Image: create("Image"),
    Platform: { OS: "web", select: (values: any) => values.web ?? values.default },
    StyleSheet: { create: (styles: any) => styles },
    Text: create("Text"),
    TextInput: create("TextInput"),
    TouchableOpacity: create("TouchableOpacity"),
    View: create("View"),
  };
});

jest.mock("lucide-react-native", () => {
  const React = require("react");
  const Icon = (props: any) => React.createElement("Icon", props);
  return { Plus: Icon, UserRound: Icon };
});

jest.mock("../services/musicService", () => ({
  musicService: {
    listArtists: jest.fn(() => Promise.resolve({ items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } })),
    createArtist: jest.fn(),
  },
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const originalConsoleError = console.error;

function textContent(node: TestNode): string {
  return node.findAllByType(Text).map((text: TestNode) => text.props.children).flat().join("");
}

describe("ArtistPicker", () => {
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
    jest.mocked(musicService.listArtists).mockResolvedValue({ items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });
  });

  it("exibe e cria o nome completo do artista sem caracteres corrompidos", async () => {
    const created = { id: "artist-1", name: "Diante do Trono", imageUrl: null, createdAt: "", updatedAt: "" };
    jest.mocked(musicService.createArtist).mockResolvedValue(created);
    const onSelect = jest.fn();
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<ArtistPicker selected={null} onSelect={onSelect} />);
    });

    act(() => {
      renderer!.root.findByType(TextInput).props.onChangeText("  Diante   do Trono  ");
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    const createOption = renderer!.root.findByProps({ testID: "artist-create-option" });
    expect(textContent(createOption)).toBe("Criar “Diante do Trono”");

    await act(async () => {
      await createOption.props.onPress();
    });

    expect(musicService.createArtist).toHaveBeenCalledWith({ name: "Diante do Trono" });
    expect(onSelect).toHaveBeenLastCalledWith(created);
    act(() => renderer!.unmount());
  });
});
