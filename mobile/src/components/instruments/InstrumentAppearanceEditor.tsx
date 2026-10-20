import React, { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { colors, iconSizes, fontSizes, fontWeights, radii, spacing } from "../../theme";
import { INSTRUMENT_CATALOG, INSTRUMENT_COLORS } from "../../constants/instrumentCatalog";
import { getInstrumentColor, getInstrumentIconKey, InstrumentGlyph } from "../../utils/instrumentVisual";
import { InstrumentBadge } from "./InstrumentBadge";

type Appearance = { name: string; colorHex: string; iconKey: string };
export function InstrumentAppearanceEditor({ value, onChange, testID = "instrument" }: { value: Appearance; onChange: (next: Appearance) => void; testID?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const instrument = { ...value, name: value.name.trim() || "Instrumento/cargo", colorHex: /^#[0-9a-f]{6}$/i.test(value.colorHex) ? value.colorHex : null };
  const activeIcon = getInstrumentIconKey(instrument);
  const activeColor = getInstrumentColor(instrument);
  const iconOptions = INSTRUMENT_CATALOG.filter((item) => item.displayName.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
  return <View style={styles.container}>
    <Text style={styles.label}>Prévia</Text>
    <View style={styles.preview}><InstrumentBadge instrument={instrument} />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Personalizar ícone e cor" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.action}>
        <Text style={styles.actionText}>{expanded ? "Recolher opções" : "Personalizar ícone e cor"}</Text>
      </TouchableOpacity>
    </View>
    {expanded ? <View style={styles.options}>
      <Text style={styles.label}>Ícone</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Usar ícone automático pelo nome" onPress={() => onChange({ ...value, iconKey: "" })} style={styles.action}><Text style={styles.actionText}>Automático pelo nome</Text></TouchableOpacity>
      <TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder="Buscar ícone" placeholderTextColor={colors.muted} accessibilityLabel="Buscar ícone" />
      <ScrollView style={styles.iconScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        <View style={styles.icons}>{iconOptions.map((item) => <TouchableOpacity key={item.key}
          accessibilityRole="button" accessibilityLabel={`Ícone ${item.displayName}`} accessibilityState={{ selected: activeIcon === item.key }}
          onPress={() => onChange({ ...value, iconKey: item.key })} style={[styles.iconOption, activeIcon === item.key && styles.selected]}>
          <InstrumentGlyph iconKey={item.key} color={colors.primary} size={iconSizes.s22} /><Text style={styles.iconLabel}>{item.displayName}</Text>
        </TouchableOpacity>)}</View>
        {!iconOptions.length ? <Text style={styles.helper}>Nenhum ícone encontrado.</Text> : null}
      </ScrollView>
      <Text style={styles.label}>Cor do ícone</Text>
      <View style={styles.swatches}>{INSTRUMENT_COLORS.map((color) => <TouchableOpacity key={color} style={[styles.swatch, { backgroundColor: color }, activeColor.toUpperCase() === color && styles.swatchSelected]} onPress={() => onChange({ ...value, colorHex: color })} accessibilityRole="button" accessibilityLabel={`Cor ${color}`} accessibilityState={{ selected: activeColor.toUpperCase() === color }} />)}</View>
      <Text style={styles.helper}>Escolha na paleta ou defina uma cor personalizada.</Text>
      <View style={styles.colorRow}>
        {Platform.OS === "web" ? React.createElement("input", { type: "color", value: activeColor, "aria-label": "Escolher cor personalizada", onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, colorHex: event.target.value.toUpperCase() }), style: { width: 44, height: 44, border: 0, padding: 0, background: "transparent", cursor: "pointer" } }) : null}
        <TextInput value={value.colorHex} onChangeText={(colorHex) => onChange({ ...value, colorHex })} style={[styles.input, styles.colorInput]} autoCapitalize="characters" maxLength={7} placeholder="#RRGGBB" placeholderTextColor={colors.muted} accessibilityLabel="Código da cor do instrumento" testID={`${testID}-color-input`} />
        <TouchableOpacity style={styles.action} accessibilityRole="button" accessibilityLabel="Restaurar cor padrão" onPress={() => onChange({ ...value, colorHex: "" })}><Text style={styles.actionText}>Cor padrão</Text></TouchableOpacity>
      </View>
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({
  container: { gap: spacing.sm, marginVertical: spacing.md }, label: { color: colors.ink, fontSize: fontSizes.s13, fontWeight: fontWeights.bold },
  preview: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm },
  action: { minHeight: 44, paddingHorizontal: spacing.sm, justifyContent: "center" }, actionText: { color: colors.primary, fontSize: fontSizes.s13, fontWeight: fontWeights.bold },
  options: { gap: spacing.sm }, icons: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, iconScroll: { maxHeight: 210 },
  iconOption: { minHeight: 68, width: 96, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", padding: spacing.xs, gap: spacing.xs },
  selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, iconLabel: { textAlign: "center", color: colors.ink, fontSize: fontSizes.s12 },
  input: { minHeight: 44, borderColor: colors.line, borderWidth: 1, borderRadius: radii.md, color: colors.ink, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: "transparent" }, swatchSelected: { borderColor: colors.ink, transform: [{ scale: 1.12 }] },
  colorRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }, colorInput: { flex: 1, minWidth: 110 }, helper: { color: colors.muted, fontSize: fontSizes.s12 },
});
