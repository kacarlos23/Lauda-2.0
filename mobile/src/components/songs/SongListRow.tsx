import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Check, Square, UserRound } from "lucide-react-native";
import { Song } from "../../types";
import { hasSongLinks, SongLinkButtons } from "../SongLinkButtons";
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
  onOpenLinks?: () => void;
  onPress: () => void;
};

export function SongListRow({
  song,
  selectionMode,
  selected,
  isLast,
  compactLinkActions = false,
  onOpenLinks,
  onPress,
}: Props) {
  const selectionLabel = `${selected ? "Desmarcar" : "Selecionar"} ${song.title}`;

  return (
    <TouchableOpacity
      style={[
        styles.row,
        compactLinkActions && styles.rowCompact,
        !isLast && styles.rowBorder,
        selected && styles.rowSelected,
      ]}
      testID={`song-row-${song.id}`}
      onPress={onPress}
      accessibilityRole={selectionMode ? "checkbox" : "button"}
      accessibilityLabel={selectionMode ? selectionLabel : `Abrir cifra ${song.title}`}
      accessibilityState={selectionMode ? { checked: selected } : undefined}
    >
      {selected ? <View style={styles.selectedRail} /> : null}
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
      {!selectionMode && hasSongLinks(song) ? (
        <View style={styles.linkActions} testID={`song-actions-${song.id}`}>
          <SongLinkButtons
            links={song}
            compact
            collapseMultiple={compactLinkActions}
            onOpenMultiple={onOpenLinks}
          />
        </View>
      ) : null}
      {selectionMode ? (
        selected ? (
          <View style={styles.check}><Check color={colors.surface} size={iconSizes.s15} strokeWidth={2.8} /></View>
        ) : (
          <Square color={colors.muted} size={iconSizes.s21} />
        )
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.control,
    backgroundColor: colors.surface,
    position: "relative",
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowCompact: {
    minHeight: 76,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
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
  linkActions: { flexShrink: 0, alignItems: "flex-end", justifyContent: "center" },
  songTitle: { color: colors.ink, fontSize: fontSizes.s15, fontWeight: fontWeights.bold },
  meta: { color: colors.muted, fontSize: fontSizes.s12, marginTop: spacing.micro },
  check: {
    width: 21,
    height: 21,
    borderRadius: radiusValues.r5,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
