import React, { useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const insets = useSafeAreaInsets();
  const [focused, setFocused] = useState<string | null>(null);
  const quantity = `${count} ${count === 1 ? "música" : "músicas"}`;
  const focusProps = (action: string) => ({
    onFocus: () => setFocused(action),
    onBlur: () => setFocused(null),
  });

  const openThemes = (operation: SongThemeOperation) => {
    const trigger = operation === "add" ? addButton.current : removeButton.current;
    if (compact || Platform.OS !== "web" || !trigger) {
      onThemeAction(operation, null);
      return;
    }
    trigger.measureInWindow((x, y, width, height) => onThemeAction(operation, { x, y, width, height }));
  };

  return (
    <View style={[styles.dock, { paddingBottom: Math.max(spacing.sm, insets.bottom) }]} testID="song-selection-dock">
      <View style={[styles.bar, compact && styles.compactBar]} testID="song-selection-bar">
        <Text style={styles.count} accessibilityLiveRegion="polite" aria-live="polite">{`${count} ${count === 1 ? "selecionada" : "selecionadas"}`}</Text>
        <View style={styles.actions}>
          {canEditThemes ? (
            <>
              <View ref={addButton} collapsable={false}>
                <Button title="Adicionar tema" variant="secondary" size="sm" style={[styles.button, focused === "add" && styles.focused]} textStyle={styles.label}
                  accessibilityLabel={`Adicionar tema a ${quantity}`} {...focusProps("add")}
                  disabled={!count || savingTheme} onPress={() => openThemes("add")} />
              </View>
              <View ref={removeButton} collapsable={false}>
                <Button title="Remover tema" variant="secondary" size="sm" style={[styles.button, styles.outline, focused === "remove" && styles.focused]} textStyle={styles.label}
                  accessibilityLabel={`Remover tema de ${quantity}`} {...focusProps("remove")}
                  disabled={!count || savingTheme} onPress={() => openThemes("remove")} />
              </View>
            </>
          ) : null}
          <Button title="Exportar PDF" size="sm" style={[styles.button, focused === "export" && styles.focused]} textStyle={styles.label}
            {...focusProps("export")} testID="songs-export-button" accessibilityLabel={`Exportar PDF de ${quantity}`} disabled={!count} loading={exporting} onPress={onExport} />
          <Button title="Cancelar" variant="ghost" size="sm" style={[styles.button, focused === "cancel" && styles.focused]} textStyle={styles.label}
            {...focusProps("cancel")} accessibilityLabel={`Cancelar seleção de ${quantity}`} onPress={onCancel} />
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
  button: { minHeight: 44, minWidth: 44, paddingHorizontal: spacing.sm, borderRadius: radiusValues.r4 },
  focused: { borderWidth: 2, borderColor: colors.accent },
  outline: { backgroundColor: colors.surface, borderColor: colors.lineStrong },
  label: { fontSize: fontSizes.s12 },
});
