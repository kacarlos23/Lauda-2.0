import React from "react";
import type { ComponentType } from "react";
import { Alert, GestureResponderEvent, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Guitar, Headphones, Link2, Mic, Play } from "lucide-react-native";
import {
  colors,
  controlSizes,
  fontSizes,
  fontWeights,
  iconSizes,
  radii,
  spacing,
} from "../theme";

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
  { key: "audioUrl", label: "Áudio", accessibilityLabel: "Abrir link de áudio", Icon: Headphones },
  { key: "videoUrl", label: "Vídeo", accessibilityLabel: "Abrir link de vídeo", Icon: Play },
];

type Props = {
  links: SongLinks;
  compact?: boolean;
  centered?: boolean;
  collapseMultiple?: boolean;
  onOpenMultiple?: () => void;
  variant?: "inline" | "sheet";
};

export function hasSongLinks(links: SongLinks): boolean {
  return LINK_ITEMS.some((item) => Boolean(links[item.key]));
}

export function getSongLinkCount(links: SongLinks): number {
  return LINK_ITEMS.filter((item) => Boolean(links[item.key])).length;
}

export function SongLinkButtons({
  links,
  compact = false,
  centered = false,
  collapseMultiple = false,
  onOpenMultiple,
  variant = "inline",
}: Props) {
  const visibleLinks = LINK_ITEMS.filter((item) => Boolean(links[item.key]));

  if (!visibleLinks.length) return null;

  if (collapseMultiple && visibleLinks.length > 1) {
    return (
      <TouchableOpacity
        style={styles.multipleLinksButton}
        onPress={(event) => {
          event.stopPropagation();
          onOpenMultiple?.();
        }}
        accessibilityRole="button"
        accessibilityLabel={`Ver ${visibleLinks.length} links da música`}
        testID="song-links-trigger"
      >
        <Link2 color={colors.primary} size={iconSizes.s15} strokeWidth={2.5} />
        <Text style={styles.multipleLinksText}>Links {visibleLinks.length}</Text>
      </TouchableOpacity>
    );
  }

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
        variant === "sheet" && styles.sheetContainer,
      ]}
      testID="song-link-buttons"
    >
      {visibleLinks.map((item) => {
        const url = links[item.key]!;
        return (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.button,
              compact && styles.buttonCompact,
              variant === "sheet" && styles.sheetButton,
            ]}
            onPress={(event) => void openLink(url, event)}
            accessibilityRole="link"
            accessibilityLabel={item.accessibilityLabel}
            testID={`song-link-${item.key}`}
          >
            <item.Icon color={colors.primary} size={compact ? iconSizes.s13 : iconSizes.s15} strokeWidth={2.6} />
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
    flexShrink: 0,
    justifyContent: "flex-end",
    gap: spacing.xs,
  },
  containerCentered: {
    justifyContent: "center",
  },
  containerCompact: {
    maxWidth: 280,
  },
  sheetContainer: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  button: {
    minHeight: controlSizes.compact,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  buttonCompact: {
    minHeight: 32,
    paddingHorizontal: spacing.sm,
  },
  buttonText: {
    color: colors.primary,
    fontSize: fontSizes.s12,
    fontWeight: fontWeights.black,
  },
  buttonTextCompact: {
    fontSize: fontSizes.s11,
  },
  multipleLinksButton: {
    minHeight: controlSizes.default,
    maxWidth: 88,
    flexShrink: 0,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primarySoftBorder,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  multipleLinksText: {
    color: colors.primary,
    fontSize: fontSizes.s11,
    fontWeight: fontWeights.black,
  },
  sheetButton: {
    minHeight: controlSizes.large,
    flexBasis: "48%",
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.primarySoftBorder,
    gap: spacing.sm,
  },
});
