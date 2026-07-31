import React from "react";
import { YouTubePlayerCardBase, YouTubePlayerCardProps } from "./YouTubePlayerCardBase";

const IFrame = "iframe" as any;

export function YouTubePlayerCard(props: YouTubePlayerCardProps) {
  return (
    <YouTubePlayerCardBase
      {...props}
      renderPlayer={({ embedUrl, onError, title }) => (
        <IFrame
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          data-testid="youtube-player-iframe"
          onError={onError}
          referrerPolicy="strict-origin-when-cross-origin"
          src={embedUrl}
          style={{ border: 0, display: "block", height: "100%", width: "100%" }}
          title={`Vídeo de ${title}`}
        />
      )}
    />
  );
}
