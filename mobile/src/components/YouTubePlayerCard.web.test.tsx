import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Alert, Linking } from "react-native";
import { YouTubePlayerCard } from "./YouTubePlayerCard.web";

jest.mock("react-native", () => {
  const React = require("react");
  const create = (type: string) => ({ children, ...props }: any) => React.createElement(type, props, children);
  return {
    Alert: { alert: jest.fn() },
    Linking: { openURL: jest.fn() },
    Platform: { select: (values: any) => values.web ?? values.default },
    Pressable: create("Pressable"),
    StyleSheet: { create: (styles: any) => styles },
    Text: create("Text"),
    View: create("View"),
  };
});

jest.mock("lucide-react-native", () => {
  const React = require("react");
  const Icon = (props: any) => React.createElement("Icon", props);
  return { CirclePlay: Icon, ExternalLink: Icon, Video: Icon };
});

const mockedLinking = Linking as jest.Mocked<typeof Linking>;
const mockedAlert = Alert as jest.Mocked<typeof Alert>;
const originalConsoleError = console.error;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("YouTubePlayerCard web", () => {
  beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      if (String(args[0]).includes("react-test-renderer is deprecated")) return;
      originalConsoleError(...args);
    });
  });

  afterAll(() => jest.restoreAllMocks());
  beforeEach(() => jest.clearAllMocks());

  it("não renderiza para uma URL ausente ou antiga não reconhecida", async () => {
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<YouTubePlayerCard videoUrl="https://example.com/video" title="Canção" />);
    });

    expect(renderer!.toJSON()).toBeNull();
  });

  it("mantém o iframe desmontado até a ação explícita e então inicia o vídeo", async () => {
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <YouTubePlayerCard videoUrl="https://youtu.be/dQw4w9WgXcQ" title="Canção" />
      );
    });

    expect(renderer!.root.findByProps({ testID: "youtube-player-placeholder" })).toBeTruthy();
    expect(renderer!.root.findAllByType("iframe" as any)).toHaveLength(0);
    expect(renderer!.root.findByProps({ testID: "youtube-player-load-button" }).props.accessibilityLabel)
      .toBe("Reproduzir vídeo de Canção");

    await act(async () => {
      renderer!.root.findByProps({ testID: "youtube-player-load-button" }).props.onPress();
    });

    const iframe = renderer!.root.findByType("iframe" as any);
    expect(iframe.props.src).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1");
    expect(iframe.props.title).toBe("Vídeo de Canção");
    expect(iframe.props.allowFullScreen).toBe(true);
  });

  it("mostra o fallback após erro de incorporação e abre a URL canônica", async () => {
    mockedLinking.openURL.mockResolvedValueOnce(undefined);
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <YouTubePlayerCard videoUrl="https://www.youtube.com/shorts/dQw4w9WgXcQ" title="Canção" />
      );
    });
    await act(async () => renderer!.root.findByProps({ testID: "youtube-player-load-button" }).props.onPress());
    await act(async () => renderer!.root.findByType("iframe" as any).props.onError());

    expect(JSON.stringify(renderer!.toJSON())).toContain("Não foi possível reproduzir este vídeo dentro do Lauda.");

    await act(async () => renderer!.root.findByProps({ testID: "youtube-player-external-link" }).props.onPress());
    expect(mockedLinking.openURL).toHaveBeenCalledWith("https://www.youtube.com/watch?v=dQw4w9WgXcQ");

    mockedLinking.openURL.mockRejectedValueOnce(new Error("falha"));
    await act(async () => renderer!.root.findByProps({ testID: "youtube-player-external-link" }).props.onPress());
    expect(mockedAlert.alert).toHaveBeenCalledWith("Erro", "Não foi possível abrir o vídeo no YouTube.");
  });
});
