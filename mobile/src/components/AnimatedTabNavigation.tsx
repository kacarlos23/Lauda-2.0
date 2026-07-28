import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import type { NavigationIconProps } from "../navigation/manifest";
import {
  colors,
  fontSizes,
  fontWeights,
  iconSizes,
  motion,
} from "../theme";
import { useReducedMotion } from "../hooks/useReducedMotion";

type AnimatedTabIconProps = {
  Icon: React.ComponentType<NavigationIconProps>;
  focused: boolean;
  itemId: string;
};

type AnimatedTabLabelProps = {
  focused: boolean;
  label: string;
};

function useSelectionProgress(selected: boolean) {
  const progress = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    Animated.timing(progress, {
      toValue: selected ? 1 : 0,
      duration: reducedMotion ? motion.reducedMs : motion.navigationSelectionMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, reducedMotion, selected]);

  return progress;
}

export function AnimatedTabIcon({
  Icon,
  focused,
  itemId,
}: AnimatedTabIconProps) {
  const progress = useSelectionProgress(focused);
  const inactiveOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <View style={styles.iconFrame}>
      <Animated.View style={[styles.iconLayer, { opacity: inactiveOpacity }]}>
        <Icon
          color={colors.inverseMeta}
          size={iconSizes.s22}
          strokeWidth={2.4}
        />
      </Animated.View>
      <Animated.View
        style={[styles.iconLayer, { opacity: progress }]}
        testID={`mobile-tab-selection-${itemId}`}
      >
        <Icon
          color={colors.inverse}
          size={iconSizes.s22}
          strokeWidth={2.4}
        />
      </Animated.View>
    </View>
  );
}

export function AnimatedTabLabel({
  focused,
  label,
}: AnimatedTabLabelProps) {
  const progress = useSelectionProgress(focused);
  const inactiveOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <View style={styles.labelFrame}>
      <Animated.Text
        numberOfLines={1}
        style={[styles.label, styles.labelInactive, { opacity: inactiveOpacity }]}
      >
        {label}
      </Animated.Text>
      <Animated.Text
        numberOfLines={1}
        style={[styles.label, styles.labelActive, { opacity: progress }]}
      >
        {label}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconFrame: {
    width: iconSizes.s22,
    height: iconSizes.s22,
  },
  iconLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  labelFrame: {
    minWidth: 54,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    position: "absolute",
    fontSize: fontSizes.s11,
    fontWeight: fontWeights.semibold,
    textAlign: "center",
  },
  labelInactive: {
    color: colors.inverseMeta,
  },
  labelActive: {
    color: colors.inverse,
  },
});
