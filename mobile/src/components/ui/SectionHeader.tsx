import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, spacing, typography } from "../../theme";

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function SectionHeader({ title, subtitle, action, style }: SectionHeaderProps) {
  return (
    <View style={[styles.header, style]}>
      <View style={styles.textGroup}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  textGroup: { flexShrink: 1 },
  title: { ...typography.screenTitle, color: colors.ink, marginBottom: spacing.xs },
  subtitle: { ...typography.subtitle, color: colors.muted },
});
