import React from "react";
import { TextInput } from "react-native";
import { colors, fontFamilies, fontSizes, lineHeights, radii, spacing } from "../../theme";
import type { VisualChordEditorProps } from "./VisualChordEditor.types";

// The visual editor runs on web; native builds retain the existing text input.
export function VisualChordEditor({ value, onChange, disabled }: VisualChordEditorProps) {
  return <TextInput value={value} onChangeText={onChange} editable={!disabled} multiline textAlignVertical="top" autoCorrect={false} autoCapitalize="none" testID="song-chord-input" accessibilityLabel="Texto ChordPro" placeholder="Use ChordPro: [G]Grande é o [D]Senhor" placeholderTextColor={colors.muted} style={{ minHeight: 496, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: spacing.md, color: colors.ink, backgroundColor: colors.surface, fontFamily: fontFamilies.monospace, fontSize: fontSizes.s14, lineHeight: lineHeights.h21 }} />;
}

