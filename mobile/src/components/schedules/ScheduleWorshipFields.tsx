import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppInput } from "../ui/AppInput";
import { Button } from "../ui/Button";
import { ScheduleSongDetails, WorshipPeriod } from "../../types";
import { worshipMoments } from "../../utils/worshipOrder";
import { colors, fontSizes, lineHeights, radii, spacing, typography } from "../../theme";

export function ScheduleWorshipPeriod({ value, onChange, disabled = false }: { value: WorshipPeriod; onChange: (period: WorshipPeriod) => void; disabled?: boolean }) {
  return <View style={[styles.panel, styles.period]} testID="schedule-worship-period">
    <Text style={styles.title}>Ordem de Culto - PDF</Text>
    <Text style={styles.help}>Vincule a escala a um per�odo. O Programa de Louvor usar� a sequ�ncia e os momentos das m�sicas abaixo.</Text>
    <View style={styles.actions}>{([[null, "N�o incluir"], ["MORNING", "Culto da manh�"], ["EVENING", "Culto da noite"]] as const).map(([period, label]) => <Button
      key={label} title={label} size="sm" variant={value === period ? "primary" : "secondary"} disabled={disabled}
      accessibilityLabel={`Per�odo: ${label}`} accessibilityState={{ selected: value === period, disabled }} onPress={() => onChange(period)}
    />)}</View>
    {value ? <Text style={styles.help}>Ao salvar, esta escala ser� inclu�da na Ordem de Culto da data selecionada.</Text> : null}
  </View>;
}

export function ScheduleParticipationFields({ value, disabled = false, onChange }: {
  value: ScheduleSongDetails; disabled?: boolean; onChange: (patch: Partial<ScheduleSongDetails>) => void;
}) {
  return <View style={styles.panel} testID={`participation-${value.songId}`}>
    <Text style={styles.title}>Momento de execu��o</Text>
    <View style={styles.actions}>{worshipMoments.map((moment) => <Button key={moment} title={moment} size="sm" disabled={disabled}
      variant={value.moment === moment ? "primary" : "secondary"} style={[styles.momentChip, value.moment === moment && styles.momentChipActive]}
      textStyle={[styles.momentText, { color: value.moment === moment ? colors.inverse : colors.primary }]}
      accessibilityLabel={`Momento: ${moment}`} accessibilityState={{ selected: value.moment === moment, disabled }} onPress={() => onChange({ moment })}
    />)}</View>
    {value.moment === "Outro" ? <AppInput label="Descri��o do momento (opcional)" accessibilityLabel="Descri��o do momento" value={value.momentDescription ?? ""} maxLength={120} editable={!disabled} onChangeText={(momentDescription) => onChange({ momentDescription })} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  period: { marginTop: spacing.lg },
  panel: { padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md },
  title: { ...typography.label, color: colors.text }, help: { ...typography.metadata, color: colors.muted },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  momentChip: { minWidth: 76, minHeight: 36, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radii.sm, borderWidth: 0, backgroundColor: colors.primarySoft },
  momentChipActive: { borderColor: "#1b654e", backgroundColor: "#1b654e" },
  momentText: { fontSize: fontSizes.s12, lineHeight: lineHeights.h18 },
});
