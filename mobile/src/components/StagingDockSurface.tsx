import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { usePathname } from "expo-router";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
import { activeMobileTabIndex, navigationItemsFor } from "../navigation/manifest";
import { useAuthStore } from "../store/authStore";
import { colors, radiusValues } from "../theme";
import { desktopIndicatorEasing, stagingTransitionMs } from "../tokens/stagingNavigation";

export const DOCK_HEIGHT = 66;
export const DOCK_BOTTOM_GAP = 10;
export const DOCK_HORIZONTAL_INSET = 8;
export const DOCK_PADDING_X = 6;
export const DOCK_PADDING_Y = 8;

const useNativeDriver = Platform.OS !== "web";

/**
 * Translucent floating dock surface with a sliding active-tab pill indicator.
 * Rendered via Tabs `tabBarBackground` so its animated position persists across route changes.
 */
export function StagingDockSurface() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const { screenWidth } = useResponsiveLayout();
  const reducedMotion = useReducedMotion();

  const tabItems = useMemo(() => navigationItemsFor("mobile-tab", user), [user]);
  const moreItems = useMemo(() => navigationItemsFor("mobile-more", user), [user]);
  const activeIndex = activeMobileTabIndex(pathname, tabItems, moreItems);
  const itemCount = tabItems.length;
  const visible = activeIndex >= 0 && activeIndex < itemCount && itemCount > 0;

  const estimatedTrackWidth = Math.max(0, screenWidth - (DOCK_HORIZONTAL_INSET + DOCK_PADDING_X) * 2);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const trackWidth = measuredWidth > 0 ? measuredWidth : estimatedTrackWidth;
  const itemWidth = itemCount > 0 && trackWidth > 0 ? trackWidth / itemCount : 0;

  const initialX = visible && itemWidth > 0 ? itemWidth * activeIndex : 0;
  const translateX = useRef(new Animated.Value(initialX)).current;
  const opacity = useRef(new Animated.Value(visible && itemWidth > 0 ? 1 : 0)).current;
  const initialized = useRef(false);
  const wasVisible = useRef(false);
  const previousLayout = useRef({ width: 0, itemCount: 0 });

  const handleTrackLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    setMeasuredWidth((current) => (current === nextWidth ? current : nextWidth));
  }, []);

  useEffect(() => {
    if (trackWidth <= 0 || itemCount <= 0) return undefined;

    const layoutChanged =
      previousLayout.current.width !== trackWidth || previousLayout.current.itemCount !== itemCount;
    previousLayout.current = { width: trackWidth, itemCount };

    const ease = Easing.bezier(...desktopIndicatorEasing);

    if (!visible) {
      wasVisible.current = false;
      if (reducedMotion || !initialized.current) {
        opacity.stopAnimation();
        opacity.setValue(0);
        initialized.current = true;
        return undefined;
      }
      const animation = Animated.timing(opacity, {
        toValue: 0,
        duration: stagingTransitionMs.dockButton,
        easing: ease,
        useNativeDriver,
      });
      animation.start();
      return () => animation.stop();
    }

    const target = (trackWidth / itemCount) * activeIndex;

    if (!initialized.current || layoutChanged || reducedMotion) {
      translateX.stopAnimation();
      opacity.stopAnimation();
      translateX.setValue(target);
      opacity.setValue(1);
      initialized.current = true;
      wasVisible.current = true;
      return undefined;
    }

    if (!wasVisible.current) {
      wasVisible.current = true;
      translateX.stopAnimation();
      opacity.stopAnimation();
      translateX.setValue(target);
      const animation = Animated.timing(opacity, {
        toValue: 1,
        duration: stagingTransitionMs.dockButton,
        easing: ease,
        useNativeDriver,
      });
      animation.start();
      return () => animation.stop();
    }

    wasVisible.current = true;
    const animation = Animated.parallel([
      Animated.timing(translateX, {
        toValue: target,
        duration: stagingTransitionMs.dockIndicator,
        easing: ease,
        useNativeDriver,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: stagingTransitionMs.dockButton,
        easing: ease,
        useNativeDriver,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [activeIndex, itemCount, opacity, reducedMotion, trackWidth, translateX, visible]);

  return (
    <View testID="staging-dock-surface" style={StyleSheet.absoluteFill}>
      <View
        style={styles.track}
        onLayout={handleTrackLayout}
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {itemWidth > 0 ? (
          <Animated.View
            testID="staging-dock-indicator"
            style={[
              styles.indicator,
              {
                width: itemWidth,
                opacity,
                transform: [{ translateX }],
              },
            ]}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    position: "absolute",
    left: DOCK_PADDING_X - 1,
    right: DOCK_PADDING_X - 1,
    top: DOCK_PADDING_Y - 1,
    bottom: DOCK_PADDING_Y - 1,
  },
  indicator: {
    height: "100%",
    borderRadius: radiusValues.r16,
    backgroundColor: colors.primarySoft,
  },
});
