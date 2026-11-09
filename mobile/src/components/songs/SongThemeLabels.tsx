import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SUGGESTED_SONG_TAGS } from "../../../../src/constants/songTags";
import { normalizeCatalogText } from "../../../../src/utils/catalogNormalization";
import { useThemeStore } from "../../store/themeStore";
import { colors, fontSizes, fontWeights, radiusValues, spacing } from "../../theme";

const palette = [
  ["#28664F", "#8CD3B1"], // Adoração
  ["#9C4E08", "#F2B170"], // Louvor/Celebração
  ["#6C35B2", "#C5A4FF"], // Comunhão/Santa Ceia
  ["#08748D", "#7BD5EA"], // Ofertório
  ["#A82761", "#F3A1C6"], // Consagração
  ["#166497", "#8ACBF1"], // Missões
  ["#A6292C", "#F6A9A9"], // Natal
  ["#836006", "#ECCD75"], // Páscoa
  ["#156C76", "#81D0D9"], // Batismo
  ["#5F5956", "#CBC1B8"], // Arrependimento
  ["#1D7239", "#99D7AA"], // Gratidão
  ["#4941AD", "#B8B0FF"], // Esperança/Volta de Cristo
] as const;
const defaults = SUGGESTED_SONG_TAGS.map(normalizeCatalogText);

export function songThemeOrder(name: string): number {
  const index = defaults.indexOf(normalizeCatalogText(name));
  return index < 0 ? defaults.length : index;
}

export function songThemeColors(name: string | null, dark: boolean) {
  const key = name ? normalizeCatalogText(name) : "";
  const order = songThemeOrder(key);
  let hash = 0;
  if (order === defaults.length) {
    for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  const [solid, bright] = key
    ? palette[order === defaults.length ? hash % palette.length : order]
    : ["#54646D", "#BAC8D1"];
  const ink = dark ? bright : solid;
  return { ink, solid, fill: `${ink}16`, border: `${ink}55` };
}

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
    lineHeight: 16,
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
