import React from "react";
import { Platform, StyleProp, StyleSheet, Text, TextInputProps, View, ViewStyle } from "react-native";
import { InputControl } from "./InputControl";
import { uiPatterns } from "./patterns";
import { colors, controlSizes, fontSizes, radii, spacing, typography } from "../../theme";

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
      <View {...(Platform.OS === "web" ? { dataSet: { laudaField: "true", invalid: Boolean(error) } } : {})} style={[styles.inputGroup, props.editable === false && styles.disabled, error && styles.inputGroupError]}>
        {icon}
        <InputControl
          embedded
          style={[styles.input, icon ? styles.inputWithIcon : null, style]}
          placeholderTextColor={placeholderTextColor}
          {...props}
          accessibilityLabel={props.accessibilityLabel ?? label ?? props.placeholder}
          invalid={Boolean(error)}
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
    ...uiPatterns.fieldLabel,
  },
  inputGroup: {
    minHeight: controlSizes.default,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  disabled: { backgroundColor: colors.surfaceMuted },
  inputGroupError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    minHeight: 42,
    paddingVertical: spacing.sm,
    color: colors.ink,
    fontSize: fontSizes.s14,
  },
  inputWithIcon: {
    paddingLeft: spacing.sm,
  },
  error: { ...typography.metadata, color: colors.danger, marginTop: spacing.xs },
  hint: { ...typography.metadata, color: colors.muted, marginTop: spacing.xs },
});
