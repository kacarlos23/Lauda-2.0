import React from "react";
import { getSongLinkCount, SongLinkButtons, hasSongLinks } from "./SongLinkButtons";
import { Linking, Alert } from "react-native";

jest.mock("react-native", () => {
  const React = require("react");
  return {
    Alert: { alert: jest.fn() },
    Linking: { openURL: jest.fn() },
    Platform: { select: (values: any) => values.web ?? values.default },
    StyleSheet: { create: (styles: any) => styles },
    Text: ({ children, ...props }: any) => React.createElement("Text", props, children),
    TouchableOpacity: ({ children, ...props }: any) => React.createElement("TouchableOpacity", props, children),
    View: ({ children, ...props }: any) => React.createElement("View", props, children),
  };
});

jest.mock("lucide-react-native", () => {
  const React = require("react");
  const Icon = ({ children, ...props }: any) => React.createElement("Icon", props, children);
  return {
    Guitar: Icon,
    Headphones: Icon,
    Link2: Icon,
    Mic: Icon,
    Play: Icon,
  };
});

const mockedLinking = Linking as jest.Mocked<typeof Linking>;
const mockedAlert = Alert as jest.Mocked<typeof Alert>;

function renderTree(node: any): any {
  if (!node || typeof node === "string") return node;
  if (typeof node.type === "function") return renderTree(node.type(node.props));
  return node;
}

function collect(node: any, type: string): any[] {
  node = renderTree(node);
  if (!node) return [];
  const children = React.Children.toArray(node.props?.children);
  const current = node.type === type ? [node] : [];
  return current.concat(children.flatMap((child) => collect(child, type)));
}

function textContent(node: any): string {
  node = renderTree(node);
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node?.props?.children) return "";
  return React.Children.toArray(node.props.children).map(textContent).join("");
}

describe("SongLinkButtons", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("não renderiza quando a música não tem links", () => {
    expect(hasSongLinks({})).toBe(false);
    expect(getSongLinkCount({})).toBe(0);
    expect(SongLinkButtons({ links: {} })).toBeNull();
  });

  it("mantém o botão direto quando há somente um link no modo compacto", () => {
    const element = SongLinkButtons({
      links: { cifraUrl: "https://example.com/cifra" },
      collapseMultiple: true,
    }) as React.ReactElement;

    expect(getSongLinkCount({ cifraUrl: "https://example.com/cifra" })).toBe(1);
    expect(textContent(element)).toContain("Cifra");
    expect(textContent(element)).not.toContain("Links 1");
    expect(collect(element, "TouchableOpacity")[0].props.accessibilityRole).toBe("link");
  });

  it("consolida dois ou mais links e evita propagação para a linha", () => {
    const onOpenMultiple = jest.fn();
    const stopPropagation = jest.fn();
    const element = SongLinkButtons({
      links: {
        cifraUrl: "https://example.com/cifra",
        videoUrl: "https://example.com/video",
      },
      collapseMultiple: true,
      onOpenMultiple,
    }) as React.ReactElement;
    const buttons = collect(element, "TouchableOpacity");

    expect(getSongLinkCount({
      cifraUrl: "https://example.com/cifra",
      videoUrl: "https://example.com/video",
    })).toBe(2);
    expect(buttons).toHaveLength(1);
    expect(textContent(element)).toBe("Links 2");
    expect(textContent(element)).not.toContain("Cifra");
    expect(textContent(element)).not.toContain("Vídeo");
    expect(buttons[0].props.testID).toBe("song-links-trigger");
    expect(buttons[0].props.accessibilityLabel).toBe("Ver 2 links da música");

    buttons[0].props.onPress({ stopPropagation });

    expect(stopPropagation).toHaveBeenCalled();
    expect(onOpenMultiple).toHaveBeenCalled();
  });

  it("renderiza apenas links preenchidos", () => {
    const element = SongLinkButtons({
      links: { cifraUrl: "https://example.com/cifra", videoUrl: "https://example.com/video" },
    }) as React.ReactElement;

    expect(hasSongLinks({ cifraUrl: "https://example.com/cifra" })).toBe(true);
    expect(textContent(element)).toContain("Cifra");
    expect(textContent(element)).toContain("Vídeo");
    expect(textContent(element)).not.toContain("Letra");
  });

  it("renderiza todos os links na variante do bottom sheet", () => {
    const links = {
      cifraUrl: "https://example.com/cifra",
      letraUrl: "https://example.com/letra",
      audioUrl: "https://example.com/audio",
      videoUrl: "https://example.com/video",
    };
    const element = SongLinkButtons({ links, variant: "sheet" }) as React.ReactElement;
    const buttons = collect(element, "TouchableOpacity");

    expect(getSongLinkCount(links)).toBe(4);
    expect(buttons).toHaveLength(4);
    expect(buttons.map((button) => button.props.accessibilityLabel)).toEqual([
      "Abrir link de cifra",
      "Abrir link de letra",
      "Abrir link de áudio",
      "Abrir link de vídeo",
    ]);
  });

  it("abre o link externo e evita propagação para a linha da música", async () => {
    mockedLinking.openURL.mockResolvedValueOnce(undefined);
    const stopPropagation = jest.fn();
    const element = SongLinkButtons({ links: { audioUrl: "https://example.com/audio" } }) as React.ReactElement;

    await collect(element, "TouchableOpacity")[0].props.onPress({ stopPropagation });

    expect(stopPropagation).toHaveBeenCalled();
    expect(mockedLinking.openURL).toHaveBeenCalledWith("https://example.com/audio");
  });

  it("exibe alerta quando não consegue abrir o link", async () => {
    mockedLinking.openURL.mockRejectedValueOnce(new Error("Falha"));
    const element = SongLinkButtons({ links: { letraUrl: "https://example.com/letra" } }) as React.ReactElement;

    await collect(element, "TouchableOpacity")[0].props.onPress({ stopPropagation: jest.fn() });

    expect(mockedAlert.alert).toHaveBeenCalledWith("Erro", "Não foi possível abrir o link.");
  });
});
