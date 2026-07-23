import React from "react";
import { ScrollView, StyleProp, StyleSheet, View, ViewProps, ViewStyle } from "react-native";
import { colors, spacing } from "../../theme";

type DataListProps = ViewProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function DataList({ children, style, ...props }: DataListProps) {
  return <View style={[styles.list, style]} {...props}>{children}</View>;
}

export function DataListRow({ children, style, ...props }: DataListProps) {
  return <View style={[styles.row, style]} {...props}>{children}</View>;
}

export function DataTable({ children, style, ...props }: DataListProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={[styles.table, style]} {...props}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  row: {
    minHeight: 56,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  table: {
    minWidth: "100%",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
});
