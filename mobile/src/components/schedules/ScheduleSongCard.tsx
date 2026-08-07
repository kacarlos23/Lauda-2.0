import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ChevronDown, ChevronUp, Music2, Trash2 } from "lucide-react-native";
import { ScheduleSong, Song } from "../../types";
import { colors, fontSizes, fontWeights, iconSizes, radii, shadow, spacing } from "../../theme";

type DisplaySong = Pick<Song, "id" | "title" | "originalKey" | "bpm" | "artist"> | ScheduleSong["song"];

type Props = {
  song: DisplaySong;
  position: number;
  onPress?: () => void;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  disableMoveUp?: boolean;
  disableMoveDown?: boolean;
};

export function ScheduleSongCard({ song, position, onPress, onRemove, onMoveUp, onMoveDown, disableMoveUp, disableMoveDown }: Props) {
  const content = (
    <>
      <View style={styles.position}><Text style={styles.positionText}>{String(position).padStart(2, "0")}</Text></View>
      {song.artist?.imageUrl ? (
        <Image source={{ uri: song.artist.imageUrl }} style={styles.image} accessibilityLabel={`Imagem de ${song.artist.name}`} />
      ) : (
        <View style={styles.placeholder}><Music2 color={colors.primary} size={iconSizes.s24} /></View>
      )}
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={2}>{song.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{song.artist?.name ?? "Artista não informado"}</Text>
        <View style={styles.metadata}>
          {song.originalKey ? <Text style={styles.metaChip}>Tom {song.originalKey}</Text> : null}
          {song.bpm ? <Text style={styles.metaChip}>{song.bpm} BPM</Text> : null}
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.card}>
      {onPress ? (
        <TouchableOpacity style={styles.main} onPress={onPress} accessibilityRole="link" accessibilityLabel={`Abrir cifra de ${song.title}`}>
          {content}
        </TouchableOpacity>
      ) : <View style={styles.main}>{content}</View>}
      {onRemove || onMoveUp || onMoveDown ? (
        <View style={styles.actions}>
          {onMoveUp ? <TouchableOpacity style={styles.iconButton} onPress={onMoveUp} disabled={disableMoveUp} accessibilityLabel={`Mover ${song.title} para cima`}><ChevronUp color={disableMoveUp ? colors.line : colors.primary} size={iconSizes.s19} /></TouchableOpacity> : null}
          {onMoveDown ? <TouchableOpacity style={styles.iconButton} onPress={onMoveDown} disabled={disableMoveDown} accessibilityLabel={`Mover ${song.title} para baixo`}><ChevronDown color={disableMoveDown ? colors.line : colors.primary} size={iconSizes.s19} /></TouchableOpacity> : null}
          {onRemove ? <TouchableOpacity style={styles.iconButton} onPress={onRemove} accessibilityLabel={`Remover ${song.title}`}><Trash2 color={colors.danger} size={iconSizes.s18} /></TouchableOpacity> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 260, flexDirection: "row", alignItems: "stretch", borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surface, overflow: "hidden", ...shadow },
  main: { flex: 1, minHeight: 104, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  position: { position: "absolute", top: spacing.xs, left: spacing.xs, zIndex: 1, minWidth: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.surfaceDark },
  positionText: { color: colors.inverse, fontSize: fontSizes.s12, fontWeight: fontWeights.bold },
  image: { width: 70, height: 70, borderRadius: radii.sm, backgroundColor: colors.background },
  placeholder: { width: 70, height: 70, borderRadius: radii.sm, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0 },
  title: { color: colors.ink, fontSize: fontSizes.s16, fontWeight: fontWeights.bold },
  artist: { marginTop: 3, color: colors.muted, fontSize: fontSizes.s14 },
  metadata: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm },
  metaChip: { color: colors.primaryDark, backgroundColor: colors.primarySoft, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 3, fontSize: fontSizes.s12, fontWeight: fontWeights.semibold },
  actions: { justifyContent: "center", borderLeftWidth: 1, borderLeftColor: colors.line, padding: spacing.xs, gap: 2 },
  iconButton: { width: 36, height: 34, alignItems: "center", justifyContent: "center", borderRadius: radii.sm },
});
