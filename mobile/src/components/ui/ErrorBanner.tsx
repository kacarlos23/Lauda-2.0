import React from "react";
import { StyleProp, StyleSheet, Text, TextStyle } from "react-native";
import { colors, radii, spacing, typography } from "../../theme";

type ErrorBannerProps = {
  message?: string | null;
  action?: React.ReactNode;
  style?: StyleProp<TextStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
};

export function ErrorBanner({ message, action, style, textStyle, testID }: ErrorBannerProps) {
  if (!message) return null;

  return (
    <>
      <Text style={[styles.error, style, textStyle]} accessibilityRole="alert" testID={testID}>
        {message}
      </Text>
      {action}
    </>
  );
}

const styles = StyleSheet.create({
  error: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radii.md,
    color: colors.danger,
    ...typography.error,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
