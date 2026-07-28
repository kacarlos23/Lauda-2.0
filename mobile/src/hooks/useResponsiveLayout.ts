import { useEffect, useState } from "react";
import { useWindowDimensions } from "react-native";
import { breakpoints, motion } from "../theme";

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const [screenSize, setScreenSize] = useState({ width, height });

  useEffect(() => {
    const timer = setTimeout(() => {
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
