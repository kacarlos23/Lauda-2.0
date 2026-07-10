import React from "react";
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";
import { colors, radii, spacing, typography } from "../../theme";

export type BadgeTone = "primary" | "success" | "warning" | "danger" | "info" | "neutral";

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
};

export function Badge({ label, tone = "primary", style, textStyle, testID }: BadgeProps) {
  return (
    <View style={[styles.badge, toneStyles[tone] ?? toneStyles.neutral, style]} testID={testID}>
      <Text style={[styles.text, toneTextStyles[tone], textStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignSelf: "flex-start",
  },
  text: {
    ...typography.badge,
  },
});

const toneStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primarySoft },
  success: { backgroundColor: colors.successSoft },
  warning: { backgroundColor: colors.warningSoft },
  danger: { backgroundColor: colors.dangerSoft },
  info: { backgroundColor: colors.infoSoft },
  neutral: { backgroundColor: colors.surfaceMuted },
});

const toneTextStyles = StyleSheet.create({
  primary: { color: colors.primary },
  success: { color: colors.success },
  warning: { color: colors.text },
  danger: { color: colors.danger },
  info: { color: colors.info },
  neutral: { color: colors.neutral },
});
