import { createContext, useContext } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";

export const StagingDockClearance = createContext(0);

export function useDockClearance() {
  return useContext(StagingDockClearance);
}

export function useDockContentClearance() {
  const clearance = useDockClearance();
  return (style: StyleProp<ViewStyle>): StyleProp<ViewStyle> => {
    if (clearance === 0) return style;

    const { paddingBottom, paddingVertical, padding } = StyleSheet.flatten(style) ?? {};
    const existing = paddingBottom ?? paddingVertical ?? padding;
    return [style, { paddingBottom: (typeof existing === "number" ? existing : 0) + clearance }];
  };
}
