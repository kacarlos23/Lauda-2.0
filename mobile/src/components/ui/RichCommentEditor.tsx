import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TextInputSelectionChangeEventData, TouchableOpacity, View } from "react-native";
import { countRichTextCharacters, RICH_TEXT_MAX_CHARACTERS } from "../../../../src/contracts/richText";
import { colors, radii, spacing } from "../../theme";
import { RichCommentView } from "./RichCommentView";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  testID?: string;
};

const colorsList = [colors.ink, colors.primary, colors.info, colors.accent, colors.danger];

export function RichCommentEditor({ value, onChange, label = "Comentários", placeholder = "Adicione comentários...", disabled, testID }: Props) {
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const count = countRichTextCharacters(value);

  const commit = (next: string, nextSelection?: { start: number; end: number }) => {
    if (countRichTextCharacters(next) > RICH_TEXT_MAX_CHARACTERS) return;
    onChange(next);
    if (nextSelection) setSelection(nextSelection);
  };

  const wrap = (open: string, close: string) => {
    const selected = value.slice(selection.start, selection.end) || "texto";
    const next = `${value.slice(0, selection.start)}${open}${selected}${close}${value.slice(selection.end)}`;
    const start = selection.start + open.length;
    commit(next, { start, end: start + selected.length });
  };

  const addList = () => {
    const selected = value.slice(selection.start, selection.end) || "Novo tópico";
    const items = selected.split(/\r?\n/).map((item) => `<li>${item}</li>`).join("");
    const replacement = `<ul>${items}</ul>`;
    commit(`${value.slice(0, selection.start)}${replacement}${value.slice(selection.end)}`, {
      start: selection.start,
      end: selection.start + replacement.length,
    });
  };

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.counter, count >= RICH_TEXT_MAX_CHARACTERS && styles.limit]}>{count}/{RICH_TEXT_MAX_CHARACTERS}</Text>
      </View>
      <View style={styles.toolbar} accessibilityLabel="Formatação dos comentários">
        <FormatButton label="B" onPress={() => wrap("<strong>", "</strong>")} style={{ fontWeight: "900" }} disabled={disabled} />
        <FormatButton label="I" onPress={() => wrap("<em>", "</em>")} style={{ fontStyle: "italic" }} disabled={disabled} />
        <FormatButton label="U" onPress={() => wrap("<u>", "</u>")} style={{ textDecorationLine: "underline" }} disabled={disabled} />
        <FormatButton label="• Lista" onPress={addList} disabled={disabled} />
        {colorsList.map((color) => (
          <TouchableOpacity key={color} style={[styles.colorButton, { backgroundColor: color }]} onPress={() => wrap(`<span style="color:${color}">`, "</span>")} disabled={disabled} accessibilityLabel={`Cor ${color}`} />
        ))}
      </View>
      <TextInput
        value={value}
        onChangeText={commit}
        selection={selection}
        onSelectionChange={(event: { nativeEvent: TextInputSelectionChangeEventData }) => setSelection(event.nativeEvent.selection)}
        style={styles.input}
        multiline
        editable={!disabled}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        textAlignVertical="top"
        accessibilityLabel={label}
      />
      {value ? <View style={styles.preview}><Text style={styles.previewLabel}>Pré-visualização</Text><RichCommentView value={value} /></View> : null}
    </View>
  );
}

function FormatButton({ label, onPress, style, disabled }: { label: string; onPress: () => void; style?: object; disabled?: boolean }) {
  return <TouchableOpacity style={styles.formatButton} onPress={onPress} disabled={disabled} accessibilityLabel={label}><Text style={[styles.formatText, style]}>{label}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { color: colors.text, fontSize: 13, fontWeight: "800" },
  counter: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  limit: { color: colors.danger },
  toolbar: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xs },
  formatButton: { minWidth: 38, height: 36, paddingHorizontal: spacing.sm, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm, backgroundColor: colors.surface },
  formatText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  colorButton: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.surface },
  input: { minHeight: 130, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, color: colors.ink, padding: spacing.md, fontSize: 14 },
  preview: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: spacing.md, backgroundColor: colors.surface },
  previewLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", marginBottom: spacing.sm, textTransform: "uppercase" },
});
