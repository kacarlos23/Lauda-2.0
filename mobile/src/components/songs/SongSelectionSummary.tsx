import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, radii, spacing } from "../../theme";

type Props = {
  selectedCount: number;
  pageEmpty: boolean;
  allPageSelected: boolean;
  onTogglePage: () => void;
  onClear: () => void;
};

function selectionCount(count: number): string {
  return `${count} ${count === 1 ? "música selecionada" : "músicas selecionadas"}`;
}

export function SongSelectionSummary({ selectedCount, pageEmpty, allPageSelected, onTogglePage, onClear }: Props) {
  return (
    <View style={styles.summary} testID="song-selection-summary">
      <Text style={styles.count} accessibilityLiveRegion="polite">{selectionCount(selectedCount)}</Text>
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={onTogglePage}
          disabled={pageEmpty}
          accessibilityRole="button"
          accessibilityLabel={allPageSelected ? "Desmarcar músicas desta página" : "Selecionar músicas desta página"}
          style={pageEmpty && styles.disabled}
          testID="song-page-selection-toggle"
        >
          <Text style={styles.link}>{allPageSelected ? "Desmarcar página" : "Selecionar página"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onClear}
          disabled={!selectedCount}
          accessibilityRole="button"
          accessibilityLabel="Limpar seleção de músicas"
          style={!selectedCount && styles.disabled}
        >
          <Text style={styles.link}>Limpar seleção</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  count: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.lg },
  link: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.4 },
});
