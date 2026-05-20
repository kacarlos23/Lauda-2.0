import { Redirect, Tabs } from "expo-router";
import type { ComponentType } from "react";
import { Church, Home, User, Users } from "lucide-react-native";
import { useAuthStore } from "../../src/store/authStore";
import { colors } from "../../src/theme";

type TabIconProps = {
  color?: string;
  size?: number;
  strokeWidth?: number;
};

const tabIcon = (Icon: ComponentType<TabIconProps>, color: string) => (
  <Icon color={color} size={22} strokeWidth={2.4} />
);

export default function TabsLayout() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "TENANT_ADMIN" || user?.role === "GLOBAL_ADMIN";

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: "800" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarLabel: "Início",
          tabBarIcon: ({ color }) => tabIcon(Home, color),
        }}
      />
      <Tabs.Screen
        name="ministries/index"
        options={{
          title: "Ministérios",
          tabBarLabel: "Ministérios",
          tabBarIcon: ({ color }) => tabIcon(Church, color),
        }}
      />
      <Tabs.Screen
        name="members/index"
        options={{
          title: "Membros",
          tabBarLabel: "Membros",
          tabBarIcon: ({ color }) => tabIcon(Users, color),
          href: isAdmin ? "/members" : null,
        }}
      />
      <Tabs.Screen
        name="members/new"
        options={{
          title: "Novo membro",
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarLabel: "Perfil",
          tabBarIcon: ({ color }) => tabIcon(User, color),
        }}
      />
      <Tabs.Screen name="ministries/[id]" options={{ href: null }} />
      <Tabs.Screen name="ministries/[id]/members" options={{ href: null }} />
      <Tabs.Screen name="ministries/assign" options={{ href: null }} />
      <Tabs.Screen name="ministries/my-assignments" options={{ href: null }} />
    </Tabs>
  );
}
