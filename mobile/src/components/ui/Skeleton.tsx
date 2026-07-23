import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors, radii } from "../../theme";

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Skeleton({ width = "100%", height = 14, style, testID }: SkeletonProps) {
  return <View style={[styles.skeleton, { width, height }, style]} testID={testID} />;
}

const styles = StyleSheet.create({
  skeleton: {
    borderRadius: radii.sm,
    backgroundColor: colors.line,
    opacity: 0.68,
  },
});
