import React from "react";
import { Platform, StyleSheet, TextInput, TextInputProps } from "react-native";
import { colors, controlSizes, spacing, typography } from "../../theme";
import { uiPatterns } from "./patterns";

type InputControlProps = TextInputProps & { embedded?: boolean; invalid?: boolean };

/** A single field appearance for forms, searches, pickers and multiline editors. */
export function InputControl({ style, embedded = false, invalid = false, editable, accessibilityState, ...props }: InputControlProps) {
  return (
    <TextInput
      {...props}
      editable={editable}
      placeholderTextColor={props.placeholderTextColor ?? colors.muted}
      accessibilityLabel={props.accessibilityLabel ?? props.placeholder}
      accessibilityState={{ ...accessibilityState, disabled: editable === false }}
      {...(Platform.OS === "web" ? { dataSet: { laudaControl: embedded ? "embedded" : "standalone" }, "aria-invalid": invalid || undefined } : {})}
      style={[
        embedded ? styles.embedded : uiPatterns.field,
        style,
        // Keep screen-specific dimensions and monospace editors, but share the field chrome.
        !embedded && styles.appearance,
        !embedded && !props.multiline && styles.singleLine,
        !embedded && props.multiline && styles.multiline,
        editable === false && styles.disabled,
        invalid && styles.invalid,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  appearance: {
    borderWidth: 1, borderColor: colors.lineStrong, borderRadius: uiPatterns.field.borderRadius,
    backgroundColor: colors.surface, color: colors.ink,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontSize: typography.body.fontSize, fontWeight: typography.body.fontWeight,
  },
  embedded: { ...typography.body, color: colors.ink, minWidth: 0, flex: 1, paddingVertical: spacing.sm },
  multiline: { textAlignVertical: "top" },
  singleLine: { minHeight: controlSizes.default },
  disabled: { backgroundColor: colors.surfaceMuted, color: colors.muted },
  invalid: { borderColor: colors.danger },
});
