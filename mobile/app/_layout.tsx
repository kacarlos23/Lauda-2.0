import { useEffect } from "react";
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
    if (isLoading) return;

    const currentGroup = segments[0];
    const isAuthRoute = currentGroup === "(auth)";

    if (user && isAuthRoute) {
      router.replace("/(tabs)");
    } else if (!user && !isAuthRoute) {
      router.replace("/(auth)/login");
    }
  }, [user, isLoading, router, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
