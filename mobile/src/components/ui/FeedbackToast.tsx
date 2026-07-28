import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, fontWeights, radii, shadow, spacing, zIndices } from "../../theme";

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
    zIndex: zIndices.toast,
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
  warning: { backgroundColor: colors.warningToast },
  error: { backgroundColor: colors.danger },
  text: { color: colors.surface, fontSize: fontSizes.s13, fontWeight: fontWeights.extrabold, textAlign: "center" },
});
