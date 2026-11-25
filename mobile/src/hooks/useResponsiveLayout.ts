import { useEffect, useRef, useState } from "react";
import { useWindowDimensions } from "react-native";
import { breakpoints, motion } from "../theme";

export function useResponsiveLayout() {
  const dimensions = typeof useWindowDimensions === "function"
    ? useWindowDimensions()
    : { width: 1280, height: 800 };
  const { width, height } = dimensions;
  const [screenSize, setScreenSize] = useState({ width, height });
  const lastApplied = useRef({ width, height });

  useEffect(() => {
    if (lastApplied.current.width === width && lastApplied.current.height === height) {
      return undefined;
    }
    const timer = setTimeout(() => {
      lastApplied.current = { width, height };
      setScreenSize({ width, height });
    }, motion.resizeDebounceMs);

    return () => clearTimeout(timer);
  }, [width, height]);

  return {
    isMobile: screenSize.width < breakpoints.mobile,
    isTablet: screenSize.width >= breakpoints.mobile && screenSize.width < breakpoints.desktop,
    isDesktop: screenSize.width >= breakpoints.desktop,
    screenWidth: screenSize.width,
    screenHeight: screenSize.height,
  };
}
