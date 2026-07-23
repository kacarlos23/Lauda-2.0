import { useEffect } from "react";
import { Platform } from "react-native";
import { Stack, useSegments } from "expo-router";
import { useRouter } from "expo-router";
import { useAuthStore } from "../src/store/authStore";

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
        background: #F4F2EC;
      }

      * {
        box-sizing: border-box;
      }

      *:focus:not(:focus-visible) {
        outline: none;
      }

      *:focus-visible {
        outline: 3px solid #C0582D !important;
        outline-offset: 2px !important;
      }

      ::selection {
        background: #C0582D;
        color: #F8FAF6;
      }

      @media (hover: hover) and (pointer: fine) {
        [role="button"]:not([aria-disabled="true"]),
        [role="link"]:not([aria-disabled="true"]) {
          transition: filter 160ms ease, background-color 160ms ease, opacity 160ms ease, transform 160ms ease;
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
          transition-duration: 0.01ms !important;
          animation-duration: 0.01ms !important;
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
      router.replace("/(tabs)");
    } else if (!user && !isAuthRoute && !isPublicInviteRoute) {
      router.replace("/(auth)/login");
    }
  }, [user, isLoading, router, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="convite" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
