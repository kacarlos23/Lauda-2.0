import { useEffect } from "react";
import { Platform } from "react-native";
import { Stack, useSegments } from "expo-router";
import { useRouter } from "expo-router";
import { RouteMetadata } from "../src/components/RouteMetadata";
import { useAuthStore } from "../src/store/authStore";
import { GROUP_HREFS } from "../src/navigation/routes";
import { colors, motion } from "../src/theme";

export default function RootLayout() {
  const { user, isLoading, loadSession } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    const styleId = "lauda-global-hover-styles";
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }

    style.textContent = `
      :root {
        color-scheme: light;
        background: ${colors.background};
      }

      * {
        box-sizing: border-box;
      }

      *:focus:not(:focus-visible) {
        outline: none;
      }

      *:focus-visible {
        outline: 3px solid ${colors.accent} !important;
        outline-offset: 2px !important;
      }

      ::selection {
        background: ${colors.accent};
        color: ${colors.inverse};
      }

      @media (hover: hover) and (pointer: fine) {
        [role="button"]:not([aria-disabled="true"]),
        [role="link"]:not([aria-disabled="true"]) {
          transition: filter ${motion.interactionMs}ms ease, background-color ${motion.interactionMs}ms ease, opacity ${motion.interactionMs}ms ease, transform ${motion.interactionMs}ms ease;
          cursor: pointer;
        }

        [role="button"]:not([aria-disabled="true"]):hover,
        [role="link"]:not([aria-disabled="true"]):hover {
          filter: brightness(0.94);
        }

        [role="button"]:not([aria-disabled="true"]):active,
        [role="link"]:not([aria-disabled="true"]):active {
          transform: translateY(1px);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          scroll-behavior: auto !important;
          transition-duration: ${motion.reducedMs}ms !important;
          animation-duration: ${motion.reducedMs}ms !important;
          animation-iteration-count: 1 !important;
        }
      }
    `;
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const currentGroup = segments[0];
    const isAuthRoute = currentGroup === "(auth)";
    const isPublicInviteRoute = currentGroup === "convite";

    if (user && isAuthRoute) {
      router.replace(GROUP_HREFS.tabs);
    } else if (!user && !isAuthRoute && !isPublicInviteRoute) {
      router.replace(GROUP_HREFS.auth);
    }
  }, [user, isLoading, router, segments]);

  return (
    <>
      <RouteMetadata />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="convite" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
