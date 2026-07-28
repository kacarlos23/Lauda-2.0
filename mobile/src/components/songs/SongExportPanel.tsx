import React from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ChevronDown, ChevronUp, Download, UserRound, X } from "lucide-react-native";
import { SongSelectionSnapshot } from "../../utils/songSelection";
import { Button } from "../ui";
import {
  colors,
  controlSizes,
  fontSizes,
  fontWeights,
  iconSizes,
  lineHeights,
  radii,
  radiusValues,
  spacing,
} from "../../theme";

type Props = {
  songs: SongSelectionSnapshot[];
  compact: boolean;
  expanded: boolean;
  screenHeight: number;
  exporting: boolean;
  onToggleExpanded: () => void;
  onRemove: (songId: string) => void;
  onExport: () => void;
  onCancel: () => void;
};

function selectedLabel(count: number): string {
  return `${count} ${count === 1 ? "selecionada" : "selecionadas"}`;
}

function exportLabel(count: number): string {
  return `Exportar ${count} ${count === 1 ? "cifra" : "cifras"}`;
}

export function SongExportPanel({
  songs,
  compact,
  expanded,
  screenHeight,
  exporting,
  onToggleExpanded,
  onRemove,
  onExport,
  onCancel,
}: Props) {
  const listMaxHeight = compact
    ? Math.max(120, Math.min(240, Math.round(screenHeight * 0.3)))
    : Math.max(160, Math.min(360, screenHeight - 360));
  const expandedContent = !compact || expanded;

  return (
    <View
      style={[styles.panel, !compact && { maxHeight: Math.max(360, screenHeight - 48) }]}
      testID="songs-export-panel"
    >
      <TouchableOpacity
        style={[styles.header, compact && styles.headerCompact]}
        onPress={compact ? onToggleExpanded : undefined}
        disabled={!compact}
        accessibilityRole={compact ? "button" : undefined}
        accessibilityLabel={compact ? `${expanded ? "Recolher" : "Expandir"} painel de exportação` : undefined}
        accessibilityState={compact ? { expanded } : undefined}
        aria-expanded={compact ? expanded : undefined}
        testID={compact ? "songs-export-card-toggle" : undefined}
      >
        <Text style={styles.title}>Exportar cifras</Text>
        <View style={styles.headerEnd}>
          <View style={styles.badge}><Text style={styles.badgeText}>{selectedLabel(songs.length)}</Text></View>
          {compact ? (
            expanded
              ? <ChevronUp color={colors.primary} size={iconSizes.s20} />
              : <ChevronDown color={colors.primary} size={iconSizes.s20} />
          ) : null}
        </View>
      </TouchableOpacity>

      {expandedContent ? (
        <>
          {songs.length ? (
            <ScrollView
              style={[styles.selectedScroller, { maxHeight: listMaxHeight }]}
              contentContainerStyle={styles.selectedList}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              accessibilityLabel="Músicas selecionadas para exportação"
            >
              {songs.map((song) => (
                <View key={song.id} style={styles.selectedRow}>
                  {song.artist.imageUrl ? (
                    <Image source={{ uri: song.artist.imageUrl }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}><UserRound color={colors.primary} size={iconSizes.s16} /></View>
                  )}
                  <View style={styles.songInfo}>
                    <Text style={styles.songTitle} numberOfLines={1}>{song.title}</Text>
                    <Text style={styles.songMeta} numberOfLines={1}>{song.artist.name} · Tom {song.originalKey}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => onRemove(song.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remover ${song.title} da exportação`}
                  >
                    <X color={colors.muted} size={iconSizes.s19} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.empty, compact && styles.emptyCompact]}>
              <Text style={styles.emptyTitle}>Nenhuma música selecionada</Text>
              <Text style={styles.emptyText}>Marque as cifras na lista para preparar o arquivo.</Text>
            </View>
          )}

          <View style={[styles.footer, compact && styles.footerCompact]}>
            <Text style={styles.description}>As cifras serão reunidas em um único arquivo PDF.</Text>
            <Button
              title={exporting ? "Gerando..." : exportLabel(songs.length)}
              icon={!exporting ? <Download color={colors.surface} size={iconSizes.s18} /> : undefined}
              loading={exporting}
              size={compact ? "md" : "lg"}
              onPress={onExport}
              disabled={!songs.length || exporting}
              accessibilityLabel={exporting ? "Gerando arquivo de cifras" : exportLabel(songs.length)}
              testID="songs-export-button"
            />
            <TouchableOpacity
              style={[styles.cancelButton, compact && styles.cancelButtonCompact]}
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancelar seleção de cifras"
            >
              <Text style={styles.cancelText}>Cancelar seleção</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  header: {
    minHeight: 68,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headerCompact: { minHeight: 58, paddingHorizontal: spacing.lg },
  title: { color: colors.ink, fontSize: fontSizes.s18, fontWeight: fontWeights.black },
  headerEnd: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  badge: { backgroundColor: colors.primarySoft, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  badgeText: { color: colors.primary, fontSize: fontSizes.s12, fontWeight: fontWeights.extrabold },
  selectedScroller: { flexGrow: 0, borderTopWidth: 1, borderTopColor: colors.line },
  selectedList: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  selectedRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: controlSizes.compact, height: controlSizes.compact, borderRadius: radiusValues.r18, backgroundColor: colors.surfaceMuted },
  avatarPlaceholder: { width: controlSizes.compact, height: controlSizes.compact, borderRadius: radiusValues.r18, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  songInfo: { flex: 1, minWidth: 0 },
  songTitle: { color: colors.ink, fontSize: fontSizes.s13, fontWeight: fontWeights.extrabold },
  songMeta: { color: colors.muted, fontSize: fontSizes.s11, marginTop: spacing.micro },
  removeButton: { width: controlSizes.compact, height: controlSizes.compact, alignItems: "center", justifyContent: "center", borderRadius: radii.sm },
  empty: { borderTopWidth: 1, borderTopColor: colors.line, padding: spacing.xl, alignItems: "center" },
  emptyCompact: { padding: spacing.lg },
  emptyTitle: { color: colors.ink, fontSize: fontSizes.s14, fontWeight: fontWeights.extrabold },
  emptyText: { color: colors.muted, fontSize: fontSizes.s12, textAlign: "center", marginTop: spacing.xs },
  footer: { borderTopWidth: 1, borderTopColor: colors.line, padding: spacing.lg, gap: spacing.md },
  footerCompact: { padding: spacing.md, gap: spacing.sm },
  description: { color: colors.muted, fontSize: fontSizes.s13, lineHeight: lineHeights.h19 },
  cancelButton: { minHeight: controlSizes.medium, alignItems: "center", justifyContent: "center" },
  cancelButtonCompact: { minHeight: 32 },
  cancelText: { color: colors.primary, fontSize: fontSizes.s13, fontWeight: fontWeights.extrabold },
});
