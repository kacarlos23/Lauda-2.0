import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, fontSizes, fontWeights, spacing } from "../../theme";

type Props = {
  selectedCount: number;
  pageEmpty: boolean;
  allPageSelected: boolean;
  onTogglePage: () => void;
  onClear: () => void;
};

export function SongSelectionSummary({ selectedCount, pageEmpty, allPageSelected, onTogglePage, onClear }: Props) {
  return (
    <View style={styles.actions} testID="song-selection-summary">
      <TouchableOpacity
        onPress={onTogglePage}
        disabled={pageEmpty}
        accessibilityRole="button"
        accessibilityLabel={allPageSelected ? "Desmarcar músicas desta página" : "Selecionar músicas desta página"}
        style={pageEmpty && styles.disabled}
        testID="song-page-selection-toggle"
        hitSlop={4}
      >
        <Text style={styles.link}>{allPageSelected ? "Desmarcar página" : "Selecionar página"}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onClear}
        disabled={!selectedCount}
        accessibilityRole="button"
        accessibilityLabel="Limpar seleção de músicas"
        style={!selectedCount && styles.disabled}
        hitSlop={4}
      >
        <Text style={styles.link}>Limpar seleção</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.md },
  link: { color: colors.primary, fontSize: fontSizes.s12, fontWeight: fontWeights.extrabold },
  disabled: { opacity: 0.4 },
});
