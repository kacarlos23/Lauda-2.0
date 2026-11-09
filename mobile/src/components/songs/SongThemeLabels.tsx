import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { songThemeColors } from "../../tokens/songThemes";
import { useThemeStore } from "../../store/themeStore";
import { colors, fontSizes, fontWeights, lineHeights, radiusValues, spacing } from "../../theme";

export function SongThemeLabels({ tags = [] }: { tags?: string[] }) {
  const dark = useThemeStore((state) => state.mode === "dark");
  return (
    <View style={styles.labels}>
      {tags.slice(0, 3).map((name) => {
        const { ink, fill, border } = songThemeColors(name, dark);
        return <Text key={name} numberOfLines={1} style={[styles.label, { color: ink, backgroundColor: fill, borderColor: border }]}>{name}</Text>;
      })}
      {tags.length > 3 ? (
        <Text style={styles.label} accessibilityLabel={`Mais ${tags.length - 3} temas`}>+{tags.length - 3}</Text>
      ) : null}
      {!tags.length ? <Text style={[styles.label, styles.noTheme]}>+ tema</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  labels: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xxs, maxWidth: "100%" },
  label: {
    fontSize: fontSizes.s11,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.h17,
    color: colors.muted,
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
