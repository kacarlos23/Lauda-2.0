import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, radii, shadow, spacing, typography } from "../../theme";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function EmptyState({ title, description, icon, action, style, testID }: EmptyStateProps) {
  return (
    <View style={[styles.empty, style]} testID={testID}>
      {icon}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    gap: spacing.sm,
    ...shadow,
  },
  title: { ...typography.sectionTitle, color: colors.ink, textAlign: "center" },
  description: { ...typography.subtitle, color: colors.muted, textAlign: "center" },
});
