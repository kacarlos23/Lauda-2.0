import React from "react";
import { ActivityIndicator, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, fontSizes, fontWeights, spacing } from "../../theme";

type LoadingStateProps = {
  message?: string;
  centered?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function LoadingState({ message, centered = true, style, testID }: LoadingStateProps) {
  return (
    <View style={[centered && styles.centered, styles.content, style]} testID={testID}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    gap: spacing.md,
  },
  message: {
    color: colors.muted,
    fontSize: fontSizes.s14,
    fontWeight: fontWeights.bold,
  },
});
