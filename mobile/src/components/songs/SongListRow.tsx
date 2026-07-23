import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Check, Square, UserRound } from "lucide-react-native";
import { Song } from "../../types";
import { SongLinkButtons } from "../SongLinkButtons";
import { colors, spacing } from "../../theme";

type Props = {
  song: Song;
  selectionMode: boolean;
  selected: boolean;
  isLast: boolean;
  onPress: () => void;
};

export function SongListRow({ song, selectionMode, selected, isLast, onPress }: Props) {
  const selectionLabel = `${selected ? "Desmarcar" : "Selecionar"} ${song.title}`;

  return (
    <TouchableOpacity
      style={[styles.row, !isLast && styles.rowBorder, selected && styles.rowSelected]}
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
        <View style={styles.avatarPlaceholder}><UserRound color={colors.primary} size={19} /></View>
      )}
      <View style={styles.info}>
        <Text style={styles.songTitle} numberOfLines={1}>{song.title}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {song.artist.name} · Tom {song.originalKey}{song.bpm ? ` · ${song.bpm} BPM` : ""}
        </Text>
      </View>
      {!selectionMode ? <SongLinkButtons links={song} compact /> : null}
      {selectionMode ? (
        selected ? (
          <View style={styles.check}><Check color={colors.surface} size={15} strokeWidth={2.8} /></View>
        ) : (
          <Square color={colors.muted} size={21} />
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
    paddingVertical: 10,
    backgroundColor: colors.surface,
    position: "relative",
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowSelected: { backgroundColor: colors.primarySoft },
  selectedRail: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.primary,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, minWidth: 0 },
  songTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  check: {
    width: 21,
    height: 21,
    borderRadius: 5,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
