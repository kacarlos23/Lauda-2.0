import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, shadow, spacing } from "../../theme";

export type FeedbackTone = "success" | "warning" | "error";

export function FeedbackToast({ message, tone = "success" }: { message: string; tone?: FeedbackTone }) {
  return (
    <View
      pointerEvents="none"
      style={[styles.toast, tone === "warning" && styles.warning, tone === "error" && styles.error]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      testID="feedback-toast"
    >
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    zIndex: 100,
    top: spacing.lg,
    right: spacing.xl,
    left: spacing.xl,
    maxWidth: 520,
    alignSelf: "center",
    borderRadius: radii.md,
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadow,
  },
  warning: { backgroundColor: "#7A5410" },
  error: { backgroundColor: colors.danger },
  text: { color: colors.surface, fontSize: 13, fontWeight: "800", textAlign: "center" },
});
