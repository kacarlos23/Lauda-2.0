import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppInput } from "../ui/AppInput";
import { Button } from "../ui/Button";
import { ScheduleSongDetails, WorshipPeriod } from "../../types";
import { worshipMoments } from "../../utils/worshipOrder";
import { colors, radii, spacing, typography } from "../../theme";

export function ScheduleWorshipPeriod({ value, onChange, disabled = false }: { value: WorshipPeriod; onChange: (period: WorshipPeriod) => void; disabled?: boolean }) {
  return <View style={[styles.panel, styles.period]} testID="schedule-worship-period">
    <Text style={styles.title}>Ordem de Culto — PDF</Text>
    <Text style={styles.help}>Vincule a escala a um período. O Programa de Louvor usará a sequência e os momentos das músicas abaixo.</Text>
    <View style={styles.actions}>{([[null, "Não incluir"], ["MORNING", "Culto da manhã"], ["EVENING", "Culto da noite"]] as const).map(([period, label]) => <Button
      key={label} title={label} size="sm" variant={value === period ? "primary" : "secondary"} disabled={disabled}
      accessibilityLabel={`Período: ${label}`} accessibilityState={{ selected: value === period, disabled }} onPress={() => onChange(period)}
    />)}</View>
    {value ? <Text style={styles.help}>Ao salvar, esta escala será incluída na Ordem de Culto da data selecionada.</Text> : null}
  </View>;
}

export function ScheduleParticipationFields({ value, disabled = false, onChange }: {
  value: ScheduleSongDetails; disabled?: boolean; onChange: (patch: Partial<ScheduleSongDetails>) => void;
}) {
  return <View style={styles.panel} testID={`participation-${value.songId}`}>
    <Text style={styles.title}>Momento de execução</Text>
    <View style={styles.actions}>{worshipMoments.map((moment) => <Button key={moment} title={moment} size="sm" disabled={disabled}
      variant={value.moment === moment ? "primary" : "secondary"} accessibilityLabel={`Momento: ${moment}`} accessibilityState={{ selected: value.moment === moment, disabled }} onPress={() => onChange({ moment })}
    />)}</View>
    {value.moment === "Outro" ? <AppInput label="Descrição do momento (opcional)" accessibilityLabel="Descrição do momento" value={value.momentDescription ?? ""} maxLength={120} editable={!disabled} onChangeText={(momentDescription) => onChange({ momentDescription })} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  period: { marginTop: spacing.lg },
  panel: { padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md },
  title: { ...typography.label, color: colors.text }, help: { ...typography.metadata, color: colors.muted },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
});
