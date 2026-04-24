import { Tabs } from "expo-router";
import { useAuthStore } from "../../src/store/authStore";

export default function TabsLayout() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "TENANT_ADMIN" || user?.role === "GLOBAL_ADMIN";

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: "#16213e",
          borderTopColor: "#0f3460",
          paddingBottom: 4,
        },
        tabBarActiveTintColor: "#e94560",
        tabBarInactiveTintColor: "#888",
        headerStyle: { backgroundColor: "#1a1a2e" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Dashboard", tabBarLabel: "Início" }}
      />
      <Tabs.Screen
        name="ministries"
        options={{ title: "Ministérios", tabBarLabel: "Ministérios" }}
      />
      <Tabs.Screen
        name="members"
        options={{
          title: "Membros",
          tabBarLabel: "Membros",
          href: isAdmin ? "/members" : null, // hidden for non-admins
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Perfil", tabBarLabel: "Perfil" }}
      />
    </Tabs>
  );
}
