import { useEffect } from "react";
import { Stack } from "expo-router";
import { useRouter } from "expo-router";
import { useAuthStore } from "../src/store/authStore";

export default function RootLayout() {
  const { user, isLoading, loadSession } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      router.replace("/(tabs)");
    } else {
      router.replace("/(auth)/login");
    }
  }, [user, isLoading]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
