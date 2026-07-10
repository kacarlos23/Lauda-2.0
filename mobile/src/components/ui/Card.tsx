import React from "react";
import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from "react-native";
import { colors, radii, shadow, spacing } from "../../theme";

type CardProps = ViewProps & {
  children: React.ReactNode;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, padded = true, style, ...props }: CardProps) {
  return (
    <View style={[styles.card, padded && styles.padded, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow,
  },
  padded: {
    padding: spacing.lg,
  },
});
