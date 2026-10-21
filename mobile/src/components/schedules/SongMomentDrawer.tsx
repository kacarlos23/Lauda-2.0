import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";

type Props = { open: boolean; id: string; children: React.ReactNode };

function useDrawerMotion(open: boolean) {
  const value = useRef(new Animated.Value(open ? 1 : 0)).current;
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (mounted) setReduced(enabled); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    const animation = Animated.timing(value, { toValue: open ? 1 : 0, duration: reduced ? 0 : 300, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [open, reduced, value]);
  return value;
}

// Native uses the measured content height; the web implementation uses CSS Grid.
export function SongMomentDrawer({ open, id, children }: Props) {
  const value = useDrawerMotion(open);
  const [height, setHeight] = useState(0);
  return <Animated.View nativeID={id} accessibilityElementsHidden={!open} importantForAccessibility={open ? "auto" : "no-hide-descendants"}
    pointerEvents={open ? "auto" : "none"} style={{ zIndex: 10, marginTop: -6, overflow: "hidden", height: value.interpolate({ inputRange: [0, 1], outputRange: [0, height] }) }}>
    <Animated.View onLayout={(event) => setHeight(event.nativeEvent.layout.height)} style={{ position: "absolute", width: "100%",
      opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }}>{children}</Animated.View>
  </Animated.View>;
}

export function SongMomentChevron({ open, children }: Omit<Props, "id">) {
  const value = useDrawerMotion(open);
  return <Animated.View style={{ transform: [{ rotate: value.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] }) }] }}>
    <View>{children}</View>
  </Animated.View>;
}
