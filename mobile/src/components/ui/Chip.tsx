import React from "react";
import { StyleProp, StyleSheet, Text, TextStyle, TouchableOpacity, TouchableOpacityProps, ViewStyle } from "react-native";
import { colors, radii, spacing, typography } from "../../theme";

type ChipProps = TouchableOpacityProps & {
  label: string;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function Chip({ label, active = false, style, textStyle, accessibilityRole = "button", ...props }: ChipProps) {
  return (
    <TouchableOpacity
      accessibilityRole={accessibilityRole}
      style={[styles.chip, active && styles.active, style]}
      {...props}
    >
      <Text style={[styles.text, active && styles.activeText, textStyle]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  active: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  text: { ...typography.label, color: colors.text },
  activeText: { color: colors.primary },
});
