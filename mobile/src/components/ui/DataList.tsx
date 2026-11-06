import React from "react";
import { ScrollView, StyleProp, StyleSheet, View, ViewProps, ViewStyle } from "react-native";
import { uiPatterns } from "./patterns";

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
    ...uiPatterns.surface,
    overflow: "hidden",
  },
  row: {
    ...uiPatterns.listRow,
  },
  table: {
    minWidth: "100%",
    ...uiPatterns.surface,
    overflow: "hidden",
  },
});
