import React from "react";
import { WebView } from "react-native-webview";
import { YouTubePlayerCardBase, YouTubePlayerCardProps } from "./YouTubePlayerCardBase";
import { isAllowedYouTubePlayerNavigation } from "../utils/youtube";

export function YouTubePlayerCard(props: YouTubePlayerCardProps) {
  return (
    <YouTubePlayerCardBase
      {...props}
      renderPlayer={({ embedUrl, onError, title, videoId }) => (
        <WebView
          accessibilityLabel={`Vídeo de ${title}`}
          allowsFullscreenVideo
          allowsInlineMediaPlayback
          domStorageEnabled
          javaScriptEnabled
          mediaPlaybackRequiresUserAction={false}
          mixedContentMode="never"
          onError={onError}
          onHttpError={onError}
          onShouldStartLoadWithRequest={(request) => isAllowedYouTubePlayerNavigation(request.url, videoId)}
          originWhitelist={["https://www.youtube.com"]}
          setSupportMultipleWindows={false}
          source={{ uri: embedUrl }}
          style={{ flex: 1, backgroundColor: "transparent" }}
          testID="youtube-player-webview"
        />
      )}
    />
  );
}
