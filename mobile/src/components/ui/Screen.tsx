import React from "react";
import { ScrollView, StyleProp, StyleSheet, useWindowDimensions, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, screen, spacing } from "../../theme";

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  maxWidth?: number | null;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Screen({
  children,
  scroll = false,
  padded = true,
  maxWidth = screen.listMaxWidth,
  style,
  contentStyle,
  testID,
}: ScreenProps) {
  const dimensions = typeof useWindowDimensions === "function"
    ? useWindowDimensions()
    : { width: 1280, height: 800 };
  const { width } = dimensions;
  const pagePadding = width < 768
    ? screen.mobilePadding
    : width < 1024
      ? screen.tabletPadding
      : screen.desktopPadding;
  const contentStyles = [
    styles.content,
    maxWidth === null ? null : { maxWidth },
    padded && [styles.padded, { paddingHorizontal: pagePadding }],
    contentStyle,
  ];

  return (
    <SafeAreaView style={[styles.safe, style]} edges={["left", "right"]} testID={testID}>
      {scroll ? (
        <ScrollView contentContainerStyle={contentStyles}>{children}</ScrollView>
      ) : (
        <View style={[styles.nonScrollContent, contentStyles]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    width: "100%",
    alignSelf: "center",
  },
  nonScrollContent: {
    flex: 1,
  },
  padded: {
    paddingTop: spacing.xl,
    paddingBottom: screen.contentBottomPadding,
  },
});
