import React from "react";
import { StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { colors, radii, spacing, typography } from "../../theme";

type AppInputProps = TextInputProps & {
  label?: string;
  icon?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
};

export function AppInput({
  label,
  icon,
  style,
  containerStyle,
  placeholderTextColor = colors.muted,
  ...props
}: AppInputProps) {
  return (
    <View style={containerStyle}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputGroup}>
        {icon}
        <TextInput
          style={[styles.input, icon ? styles.inputWithIcon : null, style]}
          placeholderTextColor={placeholderTextColor}
          {...props}
        />
      </View>
    </View>
  );
}

export { AppInput as TextInput };

const styles = StyleSheet.create({
  label: {
    color: colors.text,
    ...typography.label,
    marginBottom: spacing.sm,
  },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    color: colors.ink,
    fontSize: 16,
  },
  inputWithIcon: {
    paddingLeft: spacing.md,
  },
});
