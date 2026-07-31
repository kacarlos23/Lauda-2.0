import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { YouTubePlayerCard } from "./YouTubePlayerCard";

jest.mock("react-native", () => {
  const React = require("react");
  const create = (type: string) => ({ children, ...props }: any) => React.createElement(type, props, children);
  return {
    Alert: { alert: jest.fn() },
    Linking: { openURL: jest.fn() },
    Platform: { select: (values: any) => values.default ?? values.web },
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

jest.mock("react-native-webview", () => {
  const React = require("react");
  return { WebView: (props: any) => React.createElement("WebView", props) };
});

const originalConsoleError = console.error;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("YouTubePlayerCard native", () => {
  beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      if (String(args[0]).includes("react-test-renderer is deprecated")) return;
      originalConsoleError(...args);
    });
  });

  afterAll(() => jest.restoreAllMocks());

  it("só monta um WebView controlado depois do toque", async () => {
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <YouTubePlayerCard videoUrl="https://youtu.be/dQw4w9WgXcQ" title="Canção" />
      );
    });

    expect(renderer!.root.findAllByType("WebView" as any)).toHaveLength(0);
    await act(async () => renderer!.root.findByProps({ testID: "youtube-player-load-button" }).props.onPress());

    const webView = renderer!.root.findByType("WebView" as any);
    expect(webView.props.source).toEqual({
      uri: "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1",
    });
    expect(webView.props.originWhitelist).toEqual(["https://www.youtube.com"]);
    expect(webView.props.allowsFullscreenVideo).toBe(true);
    expect(webView.props.mediaPlaybackRequiresUserAction).toBe(false);
    expect(webView.props.onShouldStartLoadWithRequest({
      url: "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1",
    })).toBe(true);
    expect(webView.props.onShouldStartLoadWithRequest({ url: "https://example.com" })).toBe(false);
  });
});
