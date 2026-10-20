import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, iconSizes, fontSizes, fontWeights } from "../../theme";
import type { Instrument } from "../../types";
import { getInstrumentColor, getInstrumentIconKey, InstrumentGlyph } from "../../utils/instrumentVisual";

export function InstrumentBadge({ instrument }: { instrument: Pick<Instrument, "name" | "iconKey" | "colorHex"> }) {
  const color = getInstrumentColor(instrument);
  // Keep the icon legible even when a user picks a very light badge color.
  const rgb = /^#[0-9a-f]{6}$/i.test(color) ? [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16)) : [0, 0, 0];
  const iconColor = (rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114) > 185 ? colors.ink : colors.white;
  return <View style={styles.chip}>
    <View style={[styles.icon, { backgroundColor: color }]}>
      <InstrumentGlyph iconKey={getInstrumentIconKey(instrument)} size={iconSizes.s16} color={iconColor} />
    </View>
    <Text style={styles.label}>{instrument.name}</Text>
  </View>;
}

const styles = StyleSheet.create({
  chip: { alignSelf: "flex-start", maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.instrumentChip, borderRadius: 999, paddingLeft: 4, paddingRight: 10, paddingVertical: 4, minHeight: 30 },
  icon: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  label: { flexShrink: 1, color: colors.ink, fontSize: fontSizes.s13, fontWeight: fontWeights.medium },
});
