import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, spacing, typography } from "../../theme";

type MetricProps = {
  label: string;
  value: string | number;
  detail?: string;
  accent?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Metric({ label, value, detail, accent = false, style }: MetricProps) {
  return (
    <View style={[styles.metric, accent && styles.accent, style]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  metric: {
    minWidth: 152,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderLeftWidth: 1,
    borderLeftColor: colors.lineStrong,
  },
  accent: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  label: { ...typography.eyebrow, color: colors.primaryDark, textTransform: "uppercase" },
  value: { ...typography.metric, color: colors.ink, marginTop: spacing.xs },
  detail: { ...typography.metadata, color: colors.muted, marginTop: spacing.xs },
});
