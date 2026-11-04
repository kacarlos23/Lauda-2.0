import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../ui";
import { colors, spacing, typography } from "../../theme";

export function WorshipReadingCard({ text, position, editable, onEdit, onRemove, onUp, onDown, first, last }: {
  text: string; position: number; editable: boolean; onEdit: () => void; onRemove: () => void;
  onUp: () => void; onDown: () => void; first: boolean; last: boolean;
}) {
  return <View style={styles.card}>
    <Text style={styles.heading}>{String(position).padStart(2, "0")} · Leitura bíblica</Text>
    <Text style={styles.text}>{text}</Text>
    {editable ? <View style={styles.actions}>
      <Button title="Editar leitura" variant="ghost" onPress={onEdit} />
      <Button title="Subir leitura" accessibilityLabel={`Mover leitura ${position} para cima`} variant="ghost" disabled={first} onPress={onUp} />
      <Button title="Descer leitura" accessibilityLabel={`Mover leitura ${position} para baixo`} variant="ghost" disabled={last} onPress={onDown} />
      <Button title="Remover leitura" variant="ghost" onPress={onRemove} />
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.surface },
  heading: { ...typography.label, color: colors.primary }, text: { ...typography.body, color: colors.text },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
});
