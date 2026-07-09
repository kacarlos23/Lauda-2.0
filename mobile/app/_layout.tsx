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
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @media (hover: hover) and (pointer: fine) {
        [role="button"]:not([aria-disabled="true"]),
        [role="link"]:not([aria-disabled="true"]) {
          transition: filter 140ms ease, background-color 140ms ease, opacity 140ms ease;
          cursor: pointer;
        }

        [role="button"]:not([aria-disabled="true"]):hover,
        [role="link"]:not([aria-disabled="true"]):hover {
          filter: brightness(0.94);
        }
      }
    `;
    document.head.appendChild(style);
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
