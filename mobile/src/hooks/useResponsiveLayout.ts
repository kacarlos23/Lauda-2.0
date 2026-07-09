import { useEffect, useState } from "react";
import { useWindowDimensions } from "react-native";

const MOBILE_BREAKPOINT = 768;
const DESKTOP_BREAKPOINT = 1024;
const RESIZE_DEBOUNCE_MS = 120;

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const [screenSize, setScreenSize] = useState({ width, height });

  useEffect(() => {
    const timer = setTimeout(() => {
      setScreenSize({ width, height });
    }, RESIZE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [width, height]);

  return {
    isMobile: screenSize.width < MOBILE_BREAKPOINT,
    isTablet: screenSize.width >= MOBILE_BREAKPOINT && screenSize.width < DESKTOP_BREAKPOINT,
    isDesktop: screenSize.width >= DESKTOP_BREAKPOINT,
    screenWidth: screenSize.width,
    screenHeight: screenSize.height,
  };
}
