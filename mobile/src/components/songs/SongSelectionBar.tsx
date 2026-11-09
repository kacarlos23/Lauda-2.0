import React, { useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import type { SongThemeOperation } from "../../services/musicService";
import { colors, fontSizes, fontWeights, radiusValues, shadow, spacing } from "../../theme";
import { Button } from "../ui";
import type { SongThemeAnchor } from "./SongThemeMenu";

type Props = {
  count: number;
  compact: boolean;
  canEditThemes: boolean;
  savingTheme: boolean;
  exporting: boolean;
  onThemeAction: (operation: SongThemeOperation, anchor: SongThemeAnchor | null) => void;
  onExport: () => void;
  onCancel: () => void;
};

export function SongSelectionBar({
  count, compact, canEditThemes, savingTheme, exporting, onThemeAction, onExport, onCancel,
}: Props) {
  const addButton = useRef<View>(null);
  const removeButton = useRef<View>(null);

  const openThemes = (operation: SongThemeOperation) => {
    const trigger = operation === "add" ? addButton.current : removeButton.current;
    if (compact || Platform.OS !== "web" || !trigger) {
      onThemeAction(operation, null);
      return;
    }
    trigger.measureInWindow((x, y, width, height) => onThemeAction(operation, { x, y, width, height }));
  };

  return (
    <View style={styles.dock}>
      <View style={[styles.bar, compact && styles.compactBar]} testID="song-selection-bar">
        <Text style={styles.count} accessibilityLiveRegion="polite">{`${count} ${count === 1 ? "selecionada" : "selecionadas"}`}</Text>
        <View style={styles.actions}>
          {canEditThemes ? (
            <>
              <View ref={addButton} collapsable={false}>
                <Button title="Adicionar tema" variant="secondary" size="sm" style={styles.button} textStyle={styles.label}
                  disabled={!count || savingTheme} onPress={() => openThemes("add")} />
              </View>
              <View ref={removeButton} collapsable={false}>
                <Button title="Remover tema" variant="secondary" size="sm" style={[styles.button, styles.outline]} textStyle={styles.label}
                  disabled={!count || savingTheme} onPress={() => openThemes("remove")} />
              </View>
            </>
          ) : null}
          <Button title="Exportar PDF" size="sm" style={styles.button} textStyle={styles.label}
            testID="songs-export-button" accessibilityLabel="Exportar PDF" disabled={!count} loading={exporting} onPress={onExport} />
          <Button title="Cancelar" variant="ghost" size="sm" style={styles.button} textStyle={styles.label}
            accessibilityLabel="Cancelar seleção" onPress={onCancel} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: { flexShrink: 0, alignItems: "center", paddingHorizontal: spacing.sm, paddingBottom: spacing.sm, paddingTop: spacing.xxs },
  bar: {
    maxWidth: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md,
    borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radiusValues.r4, backgroundColor: colors.surface,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs, ...shadow,
  },
  compactBar: { width: "100%", flexDirection: "column", alignItems: "flex-start", gap: spacing.xxs, paddingHorizontal: spacing.sm },
  count: { color: colors.ink, fontSize: fontSizes.s13, fontWeight: fontWeights.extrabold },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xs },
  button: { minHeight: 34, paddingHorizontal: spacing.sm, borderRadius: radiusValues.r4 },
  outline: { backgroundColor: colors.surface, borderColor: colors.lineStrong },
  label: { fontSize: fontSizes.s12 },
});
