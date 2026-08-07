import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { usePathname } from "expo-router";
import {
  activeMobileTabIndex,
  type NavigationIconProps,
  type NavigationItem,
} from "../navigation/manifest";
import {
  colors,
  controlSizes,
  fontSizes,
  fontWeights,
  iconSizes,
  motion,
  overlays,
  radii,
} from "../theme";
import { useReducedMotion } from "../hooks/useReducedMotion";

const MOBILE_TAB_BUBBLE_SIZE = 68;

type AnimatedTabBubbleProps = {
  tabItems: readonly NavigationItem[];
  moreItems: readonly NavigationItem[];
};

type AnimatedTabIconProps = {
  Icon: React.ComponentType<NavigationIconProps>;
  focused: boolean;
  itemId: string;
};

type AnimatedTabLabelProps = {
  focused: boolean;
  label: string;
  itemId: string;
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

export function AnimatedTabBubble({
  tabItems,
  moreItems,
}: AnimatedTabBubbleProps) {
  const pathname = usePathname();
  const activeIndex = activeMobileTabIndex(pathname, tabItems, moreItems);
  const itemCount = tabItems.length;
  const [trackWidth, setTrackWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const scaleX = useRef(new Animated.Value(1)).current;
  const scaleY = useRef(new Animated.Value(1)).current;
  const initialized = useRef(false);
  const previousLayout = useRef({ width: 0, itemCount: 0 });
  const reducedMotion = useReducedMotion();
  const visible = activeIndex >= 0 && activeIndex < itemCount && itemCount > 0;

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    setTrackWidth((current) => current === nextWidth ? current : nextWidth);
  }, []);

  useEffect(() => {
    if (!visible || trackWidth <= 0) return undefined;

    const itemWidth = trackWidth / itemCount;
    const target = itemWidth * activeIndex + (itemWidth - MOBILE_TAB_BUBBLE_SIZE) / 2;
    const layoutChanged = previousLayout.current.width !== trackWidth
      || previousLayout.current.itemCount !== itemCount;
    previousLayout.current = { width: trackWidth, itemCount };

    if (!initialized.current || layoutChanged || reducedMotion) {
      translateX.stopAnimation();
      scaleX.stopAnimation();
      scaleY.stopAnimation();
      translateX.setValue(target);
      scaleX.setValue(1);
      scaleY.setValue(1);
      initialized.current = true;
      return undefined;
    }

    const stretchDuration = Math.round(motion.navigationSelectionMs * 0.35);
    const animation = Animated.parallel([
      Animated.timing(translateX, {
        toValue: target,
        duration: motion.navigationSelectionMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleX, {
            toValue: 1.14,
            duration: stretchDuration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(scaleY, {
            toValue: 0.92,
            duration: stretchDuration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scaleX, {
            toValue: 1,
            duration: stretchDuration,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(scaleY, {
            toValue: 1,
            duration: stretchDuration,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]);

    animation.start(({ finished }) => {
      if (!finished) return;
      translateX.setValue(target);
      scaleX.setValue(1);
      scaleY.setValue(1);
    });
    return () => animation.stop();
  }, [
    activeIndex,
    itemCount,
    reducedMotion,
    scaleX,
    scaleY,
    trackWidth,
    translateX,
    visible,
  ]);

  return (
    <View
      style={styles.bubbleTrack}
      onLayout={handleLayout}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {visible && trackWidth > 0 ? (
        <Animated.View
          style={[
            styles.selectionBubble,
            {
              transform: [
                { translateX },
                { scaleX },
                { scaleY },
              ],
            },
          ]}
          testID="mobile-tab-bubble"
        />
      ) : null}
    </View>
  );
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
  itemId,
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
        testID={`mobile-tab-label-selection-${itemId}`}
      >
        {label}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubbleTrack: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  selectionBubble: {
    position: "absolute",
    top: (controlSizes.tabBar - MOBILE_TAB_BUBBLE_SIZE) / 2,
    left: 0,
    width: MOBILE_TAB_BUBBLE_SIZE,
    height: MOBILE_TAB_BUBBLE_SIZE,
    borderRadius: radii.pill,
    backgroundColor: overlays.mobileTabSelection,
  },
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
    width: "100%",
    maxWidth: MOBILE_TAB_BUBBLE_SIZE,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    position: "absolute",
    width: "100%",
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
