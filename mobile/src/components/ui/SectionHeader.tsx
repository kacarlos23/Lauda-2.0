import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, spacing, typography } from "../../theme";

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  variant?: "page" | "section";
  style?: StyleProp<ViewStyle>;
};

export function SectionHeader({ title, subtitle, action, variant = "page", style }: SectionHeaderProps) {
  return (
    <View style={[styles.header, style]}>
      <View style={styles.textGroup}>
        <Text style={[styles.title, variant === "section" && styles.sectionTitle]}>{title}</Text>
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
    marginBottom: spacing.xl,
  },
  textGroup: { flexShrink: 1 },
  title: { ...typography.screenTitle, color: colors.ink, marginBottom: spacing.xs },
  sectionTitle: { ...typography.sectionTitle, letterSpacing: 0 },
  subtitle: { ...typography.subtitle, color: colors.muted },
});
