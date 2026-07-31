import React, { ReactNode, useEffect, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { CirclePlay, ExternalLink, Video } from "lucide-react-native";
import {
  colors,
  controlSizes,
  fontSizes,
  fontWeights,
  iconSizes,
  lineHeights,
  radii,
  spacing,
} from "../theme";
import {
  buildYouTubeEmbedUrl,
  canonicalizeYouTubeUrl,
  extractYouTubeVideoId,
} from "../utils/youtube";

export type YouTubePlayerCardProps = {
  videoUrl: string;
  title: string;
};

export type YouTubePlayerRenderContext = {
  embedUrl: string;
  onError: () => void;
  title: string;
  videoId: string;
};

type BaseProps = YouTubePlayerCardProps & {
  renderPlayer: (context: YouTubePlayerRenderContext) => ReactNode;
};

export function YouTubePlayerCardBase({ videoUrl, title, renderPlayer }: BaseProps) {
  const videoId = extractYouTubeVideoId(videoUrl);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playFocused, setPlayFocused] = useState(false);
  const [externalFocused, setExternalFocused] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [videoId]);

  if (!videoId) return null;

  const canonicalUrl = canonicalizeYouTubeUrl(videoUrl)!;
  const openExternally = async () => {
    try {
      await Linking.openURL(canonicalUrl);
    } catch {
      Alert.alert("Erro", "Não foi possível abrir o vídeo no YouTube.");
    }
  };

  return (
    <View style={styles.card} testID="youtube-player-card">
      <View style={styles.heading}>
        <Video color={colors.accent} size={iconSizes.s22} aria-hidden />
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>VÍDEO DO YOUTUBE</Text>
          <Text style={styles.headingTitle} numberOfLines={2}>{title}</Text>
        </View>
      </View>

      {loaded && !failed ? (
        <View style={styles.player} testID="youtube-player-active">
          {renderPlayer({
            embedUrl: buildYouTubeEmbedUrl(videoId),
            onError: () => setFailed(true),
            title,
            videoId,
          })}
        </View>
      ) : (
        <View style={styles.placeholder} testID="youtube-player-placeholder">
          <CirclePlay color={colors.accent} size={iconSizes.s38} aria-hidden />
          <Text style={styles.placeholderTitle}>
            {failed ? "Não foi possível reproduzir este vídeo dentro do Lauda." : "Assista sem sair da cifra"}
          </Text>
          <Text style={styles.placeholderText}>
            {failed
              ? "O vídeo pode estar privado, removido ou com a incorporação desabilitada."
              : "O player só será carregado quando você solicitar a reprodução."}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Reproduzir vídeo de ${title}`}
            focusable
            onBlur={() => setPlayFocused(false)}
            onFocus={() => setPlayFocused(true)}
            onPress={() => {
              setFailed(false);
              setLoaded(true);
            }}
            style={[styles.playButton, playFocused && styles.focused]}
            testID="youtube-player-load-button"
          >
            <Video color={colors.surface} size={iconSizes.s18} aria-hidden />
            <Text style={styles.playButtonText}>Reproduzir vídeo</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Abrir ${title} no YouTube`}
        focusable
        onBlur={() => setExternalFocused(false)}
        onFocus={() => setExternalFocused(true)}
        onPress={() => void openExternally()}
        style={[styles.externalLink, externalFocused && styles.focused]}
        testID="youtube-player-external-link"
      >
        <ExternalLink color={colors.primary} size={iconSizes.s16} aria-hidden />
        <Text style={styles.externalLinkText}>Abrir no YouTube</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  heading: {
    minHeight: controlSizes.default,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  headingCopy: { flex: 1 },
  eyebrow: {
    color: colors.accentText,
    fontSize: fontSizes.s11,
    fontWeight: fontWeights.black,
    letterSpacing: 0.8,
  },
  headingTitle: {
    color: colors.ink,
    fontSize: fontSizes.s13,
    fontWeight: fontWeights.bold,
    marginTop: spacing.xs,
  },
  placeholder: {
    width: "100%",
    minHeight: 200,
    aspectRatio: 16 / 9,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.accentSoft,
  },
  placeholderTitle: {
    color: colors.ink,
    fontSize: fontSizes.s15,
    fontWeight: fontWeights.black,
    textAlign: "center",
  },
  placeholderText: {
    maxWidth: 430,
    color: colors.muted,
    fontSize: fontSizes.s12,
    lineHeight: lineHeights.h18,
    textAlign: "center",
  },
  playButton: {
    minHeight: controlSizes.default,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  playButtonText: {
    color: colors.surface,
    fontSize: fontSizes.s13,
    fontWeight: fontWeights.black,
  },
  focused: {
    borderWidth: 3,
    borderColor: colors.ink,
  },
  player: {
    width: "100%",
    minHeight: 200,
    aspectRatio: 16 / 9,
    backgroundColor: colors.surfaceDark,
    overflow: "hidden",
  },
  externalLink: {
    minHeight: controlSizes.default,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  externalLinkText: {
    color: colors.primary,
    fontSize: fontSizes.s13,
    fontWeight: fontWeights.extrabold,
  },
});
