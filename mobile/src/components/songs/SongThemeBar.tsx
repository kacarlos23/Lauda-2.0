import React, { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { SongTagCounts } from "../../services/musicService";
import { useThemeStore } from "../../store/themeStore";
import { colors, controlSizes, fontSizes, fontWeights, radiusValues, spacing } from "../../theme";
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
  const reducedMotion = useReducedMotion();
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const options = counts ? [
    ...[...counts.items].sort((a, b) => songThemeOrder(a.name) - songThemeOrder(b.name) || a.name.localeCompare(b.name, "pt-BR")),
    { id: "untagged", name: null, count: counts.untaggedCount },
  ].filter(({ name, count }) => count > 0 || (name === null ? untagged : selected.includes(name))) : [];
  const chips = options.map(({ id, name, count }) => {
    const active = name === null ? untagged : selected.includes(name);
    const tone = songThemeColors(name, dark);
    const ink = active ? songThemeSelectedText : tone.ink;
    const label = name ?? "Sem tema";
    return (
      <TouchableOpacity
        key={id}
        onPress={() => onToggle(name)}
        activeOpacity={reducedMotion ? 1 : 0.2}
        onFocus={() => setFocusedId(id)}
        onBlur={() => setFocusedId(null)}
        style={[styles.chip, { backgroundColor: active ? tone.solid : tone.fill, borderColor: active ? tone.solid : tone.border }, Platform.OS === "web" && focusedId === id && styles.focused]}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        {...(Platform.OS === "web" ? { "aria-pressed": active } : {})}
        accessibilityLabel={`Tema ${label}, ${count} ${count === 1 ? "música" : "músicas"}, ${active ? "selecionado" : "não selecionado"}`}
      >
        <Text style={[styles.label, { color: ink }]}>{label}</Text>
        <Text style={[styles.count, { color: ink, borderLeftColor: active ? songThemeSelectedDivider : tone.border }]}>{count}</Text>
      </TouchableOpacity>
    );
  });

  if (!chips.length && !action) return null;

  return (
    <View style={styles.bar}>
      <View style={styles.heading}>
        <Text style={styles.title} accessibilityRole="header">TEMAS</Text>
        {action}
      </View>
      {chips.length > 0 && (compact ? (
        <ThemeScrollTrack>{chips}</ThemeScrollTrack>
      ) : (
        <View style={[styles.track, styles.wrap]} accessibilityRole={Platform.OS === "web" ? "toolbar" : undefined} accessibilityLabel="Filtrar por tema">{chips}</View>
      ))}
    </View>
  );
}

function ThemeScrollTrack({ children }: { children: React.ReactNode }) {
  const [width, setWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [offset, setOffset] = useState(0);
  const maxOffset = Math.max(0, contentWidth - width);
  const position = Math.max(0, Math.min(offset, maxOffset));
  const overflowing = width > 0 && maxOffset > 1;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.track, styles.scrollTrack]}
        keyboardShouldPersistTaps="handled"
        accessibilityRole={Platform.OS === "web" ? "toolbar" : undefined}
        accessibilityLabel="Filtrar por tema"
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onContentSizeChange={(nextWidth) => setContentWidth(nextWidth)}
        onScroll={(event) => setOffset(event.nativeEvent.contentOffset.x)}
        scrollEventThrottle={16}
        testID="song-theme-scroll"
      >
        {children}
      </ScrollView>
      {overflowing && position > 1 && <ScrollFade side="left" />}
      {overflowing && position < maxOffset - 1 && <ScrollFade side="right" />}
    </View>
  );
}

function ScrollFade({ side }: { side: "left" | "right" }) {
  return (
    <View
      pointerEvents="none"
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.fade, side === "left" ? styles.fadeLeft : styles.fadeRight]}
      testID={`song-theme-fade-${side}`}
    >
      {[0.2, 0.5, 0.8].map((opacity) => <View key={opacity} style={[styles.fadeStrip, { opacity }]} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { width: "100%", marginBottom: spacing.md, gap: spacing.xs },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 26, gap: spacing.sm },
  title: { fontSize: fontSizes.s12, fontWeight: fontWeights.extrabold, color: colors.muted },
  track: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  // Keep the web focus outline inside the scroll viewport.
  scrollTrack: { padding: spacing.xs },
  wrap: { flexWrap: "wrap" },
  fade: { position: "absolute", top: 0, bottom: 0, flexDirection: "row" },
  fadeLeft: { left: 0, flexDirection: "row-reverse" },
  fadeRight: { right: 0 },
  fadeStrip: { width: spacing.xs, backgroundColor: colors.background },
  focused: { outlineStyle: "solid", outlineWidth: 2, outlineOffset: 2, outlineColor: colors.primary },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: controlSizes.default,
    minWidth: controlSizes.default,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderRadius: radiusValues.r4,
  },
  label: { fontSize: fontSizes.s12, fontWeight: fontWeights.semibold },
  count: { borderLeftWidth: 1, paddingLeft: spacing.xs, fontSize: fontSizes.s11, fontWeight: fontWeights.bold },
});
