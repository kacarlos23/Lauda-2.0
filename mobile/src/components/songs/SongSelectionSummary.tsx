import React, { useState } from "react";
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
  const [focused, setFocused] = useState<string | null>(null);
  return (
    <View style={styles.actions} testID="song-selection-summary">
      <TouchableOpacity
        onPress={onTogglePage}
        disabled={pageEmpty}
        accessibilityRole="button"
        accessibilityState={{ disabled: pageEmpty }}
        accessibilityLabel={allPageSelected ? "Desmarcar músicas desta página" : "Selecionar músicas desta página"}
        style={[styles.action, pageEmpty && styles.disabled, focused === "page" && styles.focused]}
        onFocus={() => setFocused("page")}
        onBlur={() => setFocused(null)}
        testID="song-page-selection-toggle"
        hitSlop={4}
      >
        <Text style={styles.link}>{allPageSelected ? "Desmarcar página" : "Selecionar página"}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onClear}
        disabled={!selectedCount}
        accessibilityRole="button"
        accessibilityState={{ disabled: !selectedCount }}
        accessibilityLabel="Limpar seleção de músicas"
        style={[styles.action, !selectedCount && styles.disabled, focused === "clear" && styles.focused]}
        onFocus={() => setFocused("clear")}
        onBlur={() => setFocused(null)}
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
  action: { minHeight: 44, minWidth: 44, justifyContent: "center" },
  focused: { backgroundColor: colors.primarySoft },
  disabled: { opacity: 0.4 },
});
