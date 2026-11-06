import React from "react";
import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from "react-native";
import { spacing } from "../../theme";
import { uiPatterns } from "./patterns";

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
    ...uiPatterns.surface,
  },
  padded: {
    padding: spacing.xl,
  },
});
