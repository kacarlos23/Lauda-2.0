import React from "react";
import { GestureResponderEvent, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ChevronDown, ChevronUp, Music2, Trash2 } from "lucide-react-native";
import { ScheduleSong, Song } from "../../types";
import { colors, fontSizes, fontWeights, iconSizes, radii, shadow, spacing } from "../../theme";

type DisplaySong = Pick<Song, "id" | "title" | "originalKey" | "bpm" | "artist"> | ScheduleSong["song"];

type Props = {
  song: DisplaySong;
  position: number;
  onPress?: (event: GestureResponderEvent) => void;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  disableMoveUp?: boolean;
  disableMoveDown?: boolean;
  footer?: React.ReactNode;
  momentLabel?: string;
  compact?: boolean;
};

export function ScheduleSongCard({ song, position, onPress, onRemove, onMoveUp, onMoveDown, disableMoveUp, disableMoveDown, footer, momentLabel, compact = false }: Props) {
  const content = (
    <>
      <View style={styles.position}><Text style={styles.positionText}>{String(position).padStart(2, "0")}</Text></View>
      {song.artist?.imageUrl ? (
        <Image source={{ uri: song.artist.imageUrl }} style={[styles.image, compact && styles.compactImage]} accessibilityLabel={`Imagem de ${song.artist.name}`} />
      ) : (
        <View style={[styles.placeholder, compact && styles.compactImage]}><Music2 color={colors.primary} size={iconSizes.s24} /></View>
      )}
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={2}>{song.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{song.artist?.name ?? "Artista não informado"}</Text>
        <View style={[styles.metadata, compact && styles.compactMetadata]}>
          {momentLabel ? <Text style={styles.metaChip}>{momentLabel}</Text> : null}
          {song.originalKey ? <Text style={styles.metaChip}>Tom {song.originalKey}</Text> : null}
          {song.bpm ? <Text style={styles.metaChip}>{song.bpm} BPM</Text> : null}
        </View>
      </View>
    </>
  );

  const card = (
    <View testID={compact ? "schedule-song-compact" : undefined} style={[styles.card, !compact && styles.raisedCard, compact && styles.compactCard]}>
      {onPress ? (
        <TouchableOpacity style={[styles.main, compact && styles.compactMain]} onPress={onPress} accessibilityRole="link" accessibilityLabel={`Abrir cifra de ${song.title}`}>
          {content}
        </TouchableOpacity>
      ) : <View style={[styles.main, compact && styles.compactMain]}>{content}</View>}
      {onRemove || onMoveUp || onMoveDown ? (
        <View style={styles.actions}>
          {onMoveUp ? <TouchableOpacity accessibilityRole="button" style={styles.iconButton} onPress={onMoveUp} disabled={disableMoveUp} accessibilityLabel={`Mover ${song.title} para cima`}><ChevronUp color={disableMoveUp ? colors.line : colors.primary} size={iconSizes.s19} /></TouchableOpacity> : null}
          {onMoveDown ? <TouchableOpacity accessibilityRole="button" style={styles.iconButton} onPress={onMoveDown} disabled={disableMoveDown} accessibilityLabel={`Mover ${song.title} para baixo`}><ChevronDown color={disableMoveDown ? colors.line : colors.primary} size={iconSizes.s19} /></TouchableOpacity> : null}
          {onRemove ? <TouchableOpacity accessibilityRole="button" style={styles.iconButton} onPress={onRemove} accessibilityLabel={`Remover ${song.title}`}><Trash2 color={colors.danger} size={iconSizes.s18} /></TouchableOpacity> : null}
        </View>
      ) : null}
    </View>
  );
  return footer ? <View style={styles.withFooter}>{card}{footer}</View> : card;
}

const styles = StyleSheet.create({
  compactCard: { width: "100%", minWidth: 0, flexGrow: 0, flexShrink: 0, flexBasis: "auto" },
  compactMain: { minHeight: 88, padding: spacing.control },
  compactImage: { width: 60, height: 60 },
  compactMetadata: { marginTop: spacing.xs },
  withFooter: { flex: 1, minWidth: 260, gap: spacing.sm },
  card: { flex: 1, minWidth: 260, flexDirection: "row", alignItems: "stretch", borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surface, overflow: "hidden" },
  raisedCard: { ...shadow },
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
