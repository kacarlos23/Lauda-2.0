import React from "react";
import { StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { colors, radii, spacing, typography } from "../../theme";

type AppInputProps = TextInputProps & {
  label?: string;
  icon?: React.ReactNode;
  endAdornment?: React.ReactNode;
  error?: string | null;
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export function AppInput({
  label,
  icon,
  endAdornment,
  error,
  hint,
  style,
  containerStyle,
  placeholderTextColor = colors.muted,
  ...props
}: AppInputProps) {
  return (
    <View style={containerStyle}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputGroup, error && styles.inputGroupError]}>
        {icon}
        <TextInput
          style={[styles.input, icon ? styles.inputWithIcon : null, style]}
          placeholderTextColor={placeholderTextColor}
          {...props}
          accessibilityState={{ disabled: Boolean(props.editable === false) }}
        />
        {endAdornment}
      </View>
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export { AppInput as Field, AppInput as TextInput };

const styles = StyleSheet.create({
  label: {
    color: colors.text,
    ...typography.label,
    marginBottom: spacing.xs,
  },
  inputGroup: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  inputGroupError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    minHeight: 42,
    paddingVertical: spacing.sm,
    color: colors.ink,
    fontSize: 14,
  },
  inputWithIcon: {
    paddingLeft: spacing.sm,
  },
  error: { ...typography.metadata, color: colors.danger, marginTop: spacing.xs },
  hint: { ...typography.metadata, color: colors.muted, marginTop: spacing.xs },
});
