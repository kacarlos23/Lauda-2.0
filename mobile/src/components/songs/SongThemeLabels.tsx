import React, { useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { songThemeColors } from "../../tokens/songThemes";
import { useThemeStore } from "../../store/themeStore";
import { colors, fontSizes, fontWeights, lineHeights, radiusValues, spacing } from "../../theme";

export function SongThemeLabels({ tags = [], onAdd }: { tags?: string[]; onAdd?: () => void }) {
  const dark = useThemeStore((state) => state.mode === "dark");
  const [focused, setFocused] = useState(false);
  const visible = tags.slice(0, 3);
  const summary = tags.length ? `Temas: ${[...visible, ...(tags.length > 3 ? [`+${tags.length - 3}`] : [])].join(", ")}` : "Sem temas";
  const canAdd = !tags.length && Boolean(onAdd);
  const emptyLabel = <Text aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.label, styles.noTheme]}>+ tema</Text>;
  return (
    <View role={canAdd ? undefined : "group"} style={[styles.labels, canAdd && styles.addArea]} accessible={!canAdd} accessibilityLabel={canAdd ? undefined : summary}>
      {visible.map((name) => {
        const { fill, border } = songThemeColors(name, dark);
        return <Text aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" key={name} numberOfLines={1} style={[styles.label, { backgroundColor: fill, borderColor: border }]}>{name}</Text>;
      })}
      {tags.length > 3 ? (
        <Text aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.label}>+{tags.length - 3}</Text>
      ) : null}
      {!tags.length && (onAdd ? (
        <TouchableOpacity
          accessibilityRole="button" accessibilityLabel="Adicionar tema" onPress={onAdd}
          hitSlop={9} activeOpacity={1} style={[styles.add, focused && styles.focused]}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        >{emptyLabel}</TouchableOpacity>
      ) : emptyLabel)}
    </View>
  );
}

const styles = StyleSheet.create({
  labels: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xxs, maxWidth: "100%" },
  addArea: { minHeight: 44 },
  // RN Web ignores hitSlop, so its transparent button has the full target size.
  add: { minHeight: Platform.OS === "web" ? 44 : 26, minWidth: 44, justifyContent: "center" },
  focused: Platform.OS === "web" ? { outlineStyle: "solid", outlineWidth: 2, outlineColor: colors.primary, outlineOffset: 2 } : {},
  label: {
    fontSize: fontSizes.s11,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.h17,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radiusValues.r2,
    paddingHorizontal: spacing.xs,
    maxWidth: "100%",
    overflow: "hidden",
  },
  noTheme: { borderStyle: "dashed", backgroundColor: "transparent", fontWeight: fontWeights.medium },
});
