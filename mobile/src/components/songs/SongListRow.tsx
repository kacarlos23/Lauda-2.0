import React, { useRef } from "react";
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Check, Square, Tag, UserRound } from "lucide-react-native";
import { Song } from "../../types";
import { hasSongLinks, SongLinkButtons } from "../SongLinkButtons";
import { SongThemeLabels } from "./SongThemeLabels";
import type { SongThemeAnchor } from "./SongThemeMenu";
import {
  colors,
  controlSizes,
  fontSizes,
  fontWeights,
  iconSizes,
  radiusValues,
  spacing,
} from "../../theme";

type Props = {
  song: Song;
  selectionMode: boolean;
  selected: boolean;
  isLast: boolean;
  compactLinkActions?: boolean;
  editingThemes?: boolean;
  onEditThemes?: (anchor: SongThemeAnchor | null) => void;
  onOpenLinks?: () => void;
  onPress: () => void;
};

export function SongListRow({
  song,
  selectionMode,
  selected,
  isLast,
  compactLinkActions = false,
  editingThemes = false,
  onEditThemes,
  onOpenLinks,
  onPress,
}: Props) {
  const themeButton = useRef<View>(null);
  const selectionLabel = `${selected ? "Desmarcar" : "Selecionar"} ${song.title}`;
  const showLinks = !selectionMode && hasSongLinks(song);
  const openThemes = () => {
    if (Platform.OS !== "web" || compactLinkActions || !themeButton.current) {
      onEditThemes?.(null);
      return;
    }
    themeButton.current.measureInWindow((x, y, width, height) => {
      onEditThemes?.({ x, y, width, height });
    });
  };
  const themes = <SongThemeLabels tags={song.tags} onAdd={onEditThemes ? openThemes : undefined} />;

  return (
    <View
      style={[styles.row, compactLinkActions && styles.rowCompact, !isLast && styles.rowBorder, selected && styles.rowSelected]}
      testID={`song-row-${song.id}`}
    >
      {selected ? <View style={styles.selectedRail} /> : null}
      <View style={styles.headline}>
        <TouchableOpacity
          style={[styles.identity, !compactLinkActions && styles.desktopIdentity]}
          testID={`song-row-control-${song.id}`}
          onPress={onPress}
          accessibilityRole={selectionMode ? "checkbox" : "button"}
          accessibilityLabel={selectionMode ? selectionLabel : `Abrir cifra ${song.title}`}
          accessibilityState={selectionMode ? { checked: selected } : undefined}
          aria-checked={selectionMode ? selected : undefined}
        >
          {song.artist.imageUrl ? (
            <Image source={{ uri: song.artist.imageUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}><UserRound color={colors.primary} size={iconSizes.s19} /></View>
          )}
          <View style={styles.info} testID={`song-info-${song.id}`}>
            <Text style={styles.songTitle} numberOfLines={1}>{song.title}</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {song.artist.name} · Tom {song.originalKey}{song.bpm ? ` · ${song.bpm} BPM` : ""}
            </Text>
          </View>
          {selectionMode ? (
            selected ? (
              <View style={styles.check}><Check color={colors.surface} size={iconSizes.s15} strokeWidth={2.8} /></View>
            ) : (
              <Square color={colors.muted} size={iconSizes.s21} />
            )
          ) : null}
        </TouchableOpacity>
        {!compactLinkActions ? <View style={styles.desktopThemes}>{themes}</View> : null}
        {showLinks || onEditThemes ? (
          <View style={styles.actions} testID={`song-actions-${song.id}`}>
            {onEditThemes ? (
              <View ref={themeButton} collapsable={false}>
                <TouchableOpacity
                  style={[styles.themeButton, editingThemes && styles.themeButtonActive]}
                  onPress={openThemes}
                  accessibilityRole="button"
                  accessibilityLabel={`Editar temas de ${song.title}`}
                  accessibilityState={{ expanded: editingThemes }}
                  aria-expanded={editingThemes}
                  hitSlop={4}
                >
                  <Tag color={colors.primary} size={iconSizes.s16} />
                </TouchableOpacity>
              </View>
            ) : null}
            {showLinks ? (
              <SongLinkButtons links={song} compact collapseMultiple={compactLinkActions} onOpenMultiple={onOpenLinks} />
            ) : null}
          </View>
        ) : null}
      </View>
      {compactLinkActions ? <View style={styles.mobileThemes}>{themes}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 66,
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.control,
    backgroundColor: colors.surface,
    position: "relative",
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowCompact: {
    minHeight: 76,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  rowSelected: { backgroundColor: colors.primarySoft },
  selectedRail: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.primary,
  },
  headline: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  identity: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  desktopIdentity: { minWidth: 144 },
  avatar: { width: controlSizes.medium, height: controlSizes.medium, borderRadius: radiusValues.r20, backgroundColor: colors.surfaceMuted },
  avatarPlaceholder: {
    width: controlSizes.medium,
    height: controlSizes.medium,
    borderRadius: radiusValues.r20,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, minWidth: 0 },
  desktopThemes: { flexShrink: 1, maxWidth: "48%" },
  mobileThemes: { marginLeft: controlSizes.medium + spacing.sm },
  actions: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  themeButton: {
    width: 32, height: 32, borderRadius: radiusValues.r4, borderWidth: 1,
    borderColor: colors.line, alignItems: "center", justifyContent: "center",
  },
  themeButtonActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  songTitle: { color: colors.ink, fontSize: fontSizes.s15, fontWeight: fontWeights.bold },
  meta: { color: colors.muted, fontSize: fontSizes.s12, marginTop: spacing.micro },
  check: {
    width: 21,
    height: 21,
    borderRadius: radiusValues.r4,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
