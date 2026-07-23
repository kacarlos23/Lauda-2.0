import React from "react";
import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from "react-native";
import { colors, spacing } from "../../theme";

type ToolbarProps = ViewProps & {
  children: React.ReactNode;
  divided?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Toolbar({ children, divided = true, style, ...props }: ToolbarProps) {
  return (
    <View style={[styles.toolbar, divided && styles.divided, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  divided: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
});
