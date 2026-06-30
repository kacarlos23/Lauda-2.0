import React from "react";
import type { ComponentType } from "react";
import { Alert, GestureResponderEvent, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Guitar, Headphones, Mic, Play } from "lucide-react-native";
import { colors, radii, spacing } from "../theme";

export type SongLinks = {
  cifraUrl?: string | null;
  letraUrl?: string | null;
  audioUrl?: string | null;
  videoUrl?: string | null;
};

type LinkIconProps = {
  color?: string;
  size?: number;
  strokeWidth?: number;
};

type LinkItem = {
  key: keyof SongLinks;
  label: string;
  accessibilityLabel: string;
  Icon: ComponentType<LinkIconProps>;
};

const LINK_ITEMS: LinkItem[] = [
  { key: "cifraUrl", label: "Cifra", accessibilityLabel: "Abrir link de cifra", Icon: Guitar },
  { key: "letraUrl", label: "Letra", accessibilityLabel: "Abrir link de letra", Icon: Mic },
  { key: "audioUrl", label: "Audio", accessibilityLabel: "Abrir link de áudio", Icon: Headphones },
  { key: "videoUrl", label: "Video", accessibilityLabel: "Abrir link de vídeo", Icon: Play },
];

type Props = {
  links: SongLinks;
  compact?: boolean;
  centered?: boolean;
};

export function hasSongLinks(links: SongLinks): boolean {
  return LINK_ITEMS.some((item) => Boolean(links[item.key]));
}

export function SongLinkButtons({ links, compact = false, centered = false }: Props) {
  const visibleLinks = LINK_ITEMS.filter((item) => Boolean(links[item.key]));

  if (!visibleLinks.length) return null;

  const openLink = async (url: string, event?: GestureResponderEvent) => {
    event?.stopPropagation();
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Erro", "Não foi possível abrir o link.");
    }
  };

  return (
    <View
      style={[
        styles.container,
        centered && styles.containerCentered,
        compact && styles.containerCompact,
      ]}
      testID="song-link-buttons"
    >
      {visibleLinks.map((item) => {
        const url = links[item.key]!;
        return (
          <TouchableOpacity
            key={item.key}
            style={[styles.button, compact && styles.buttonCompact]}
            onPress={(event) => void openLink(url, event)}
            accessibilityRole="link"
            accessibilityLabel={item.accessibilityLabel}
            testID={`song-link-${item.key}`}
          >
            <item.Icon color={colors.primary} size={compact ? 13 : 15} strokeWidth={2.6} />
            <Text style={[styles.buttonText, compact && styles.buttonTextCompact]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: spacing.xs,
  },
  containerCentered: {
    justifyContent: "center",
  },
  containerCompact: {
    maxWidth: 280,
  },
  button: {
    minHeight: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  buttonCompact: {
    minHeight: 30,
    paddingHorizontal: spacing.sm,
  },
  buttonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  buttonTextCompact: {
    fontSize: 11,
  },
});
