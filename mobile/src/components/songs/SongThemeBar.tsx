import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SongTagCounts } from "../../services/musicService";
import { useThemeStore } from "../../store/themeStore";
import { colors, fontSizes, fontWeights, radiusValues, spacing } from "../../theme";
import { songThemeColors, songThemeOrder, songThemeSelectedDivider, songThemeSelectedText } from "../../tokens/songThemes";

type Props = {
  counts: SongTagCounts | null;
  selected: string[];
  untagged: boolean;
  compact: boolean;
  onToggle: (name: string | null) => void;
  action?: React.ReactNode;
};

export function SongThemeBar({ counts, selected, untagged, compact, onToggle, action }: Props) {
  const dark = useThemeStore((state) => state.mode === "dark");
  const options = counts ? [
    ...[...counts.items].sort((a, b) => songThemeOrder(a.name) - songThemeOrder(b.name) || a.name.localeCompare(b.name, "pt-BR")),
    { id: "untagged", name: null, count: counts.untaggedCount },
  ] : [];
  const chips = options.map(({ id, name, count }) => {
    const active = name === null ? untagged : selected.includes(name);
    const tone = songThemeColors(name, dark);
    const ink = active ? songThemeSelectedText : tone.ink;
    const label = name ?? "Sem tema";
    return (
      <TouchableOpacity
        key={id}
        onPress={() => onToggle(name)}
        style={[styles.chip, { backgroundColor: active ? tone.solid : tone.fill, borderColor: active ? tone.solid : tone.border }]}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        {...(Platform.OS === "web" ? { "aria-pressed": active } : {})}
        accessibilityLabel={`${label}, ${count} ${count === 1 ? "música" : "músicas"}`}
      >
        <Text style={[styles.label, { color: ink }]}>{label}</Text>
        <Text style={[styles.count, { color: ink, borderLeftColor: active ? songThemeSelectedDivider : tone.border }]}>{count}</Text>
      </TouchableOpacity>
    );
  });

  return (
    <View style={styles.bar}>
      <View style={styles.heading}>
        <Text style={styles.title} accessibilityRole="header">TEMAS</Text>
        {action}
      </View>
      {compact ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.track} keyboardShouldPersistTaps="handled" testID="song-theme-scroll">
          {chips}
        </ScrollView>
      ) : (
        <View style={[styles.track, styles.wrap]}>{chips}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { width: "100%", marginBottom: spacing.md, gap: spacing.xs },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 26, gap: spacing.sm },
  title: { fontSize: fontSizes.s12, fontWeight: fontWeights.extrabold, color: colors.muted },
  track: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  wrap: { flexWrap: "wrap" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 30,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderRadius: radiusValues.r4,
  },
  label: { fontSize: fontSizes.s12, fontWeight: fontWeights.semibold },
  count: { borderLeftWidth: 1, paddingLeft: spacing.xs, fontSize: fontSizes.s11, fontWeight: fontWeights.bold },
});
