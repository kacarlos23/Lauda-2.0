import { Redirect, Tabs } from "expo-router";
import type { ComponentType } from "react";
import { CalendarClock, Church, Home, Music2, Users } from "lucide-react-native";
import { useAuthStore } from "../../src/store/authStore";
import { ProfileHeaderButton } from "../../src/components/ProfileHeaderButton";
import { colors, radii, shadow } from "../../src/theme";
import { canAccessChurchAdmin, canViewMembers } from "../../src/utils/permissions";

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

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: "transparent",
          height: 72,
          paddingTop: 8,
          paddingBottom: 10,
          marginHorizontal: 12,
          marginBottom: 10,
          borderRadius: radii.xl,
          position: "absolute",
          ...shadow,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "800" },
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.ink,
        headerTitle: () => null,
        headerRight: () => <ProfileHeaderButton />,
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
        name="schedules/index"
        options={{
          title: "Escalas",
          tabBarLabel: "Escalas",
          tabBarIcon: ({ color }) => tabIcon(CalendarClock, color),
          href: "/schedules" as never,
        }}
      />
      <Tabs.Screen name="schedules/new" options={{ title: "Nova Escala", href: null, headerLeft: () => null }} />
      <Tabs.Screen name="schedules/[id]/edit" options={{ title: "Editar Escala", href: null, headerLeft: () => null }} />
      <Tabs.Screen
        name="ministries/index"
        options={{
          title: "Ministérios",
          tabBarLabel: "Ministérios",
          tabBarIcon: ({ color }) => tabIcon(Church, color),
          href: "/ministries",
        }}
      />
      <Tabs.Screen
        name="ministries/[id]"
        options={{
          title: "Ministério",
          href: null,
          headerLeft: () => null,
        }}
      />
      <Tabs.Screen
        name="ministries/[id]/members"
        options={{
          title: "Membros do ministério",
          href: null,
          headerLeft: () => null,
        }}
      />
      <Tabs.Screen
        name="ministries/assign"
        options={{
          title: "Atribuir membro",
          href: null,
          headerLeft: () => null,
        }}
      />
      <Tabs.Screen
        name="songs/index"
        options={{
          title: "Músicas",
          tabBarLabel: "Músicas",
          tabBarIcon: ({ color }) => tabIcon(Music2, color),
          href: "/songs" as never,
        }}
      />
      <Tabs.Screen name="songs/new" options={{ title: "Nova música", href: null, headerLeft: () => null }} />
      <Tabs.Screen name="songs/[id]" options={{ title: "Cifra", href: null, headerLeft: () => null }} />
      <Tabs.Screen name="songs/[id]/edit" options={{ title: "Editar música", href: null, headerLeft: () => null }} />
      <Tabs.Screen name="artists/index" options={{ title: "Artistas", href: null, headerLeft: () => null }} />
      <Tabs.Screen
        name="members/index"
        options={{
          title: "Membros",
          tabBarLabel: "Membros",
          tabBarIcon: ({ color }) => tabIcon(Users, color),
          href: canViewMembers(user?.role) ? "/members" : null,
        }}
      />
      <Tabs.Screen
        name="members/new"
        options={{
          title: "Novo membro",
          href: null,
          headerLeft: () => null,
        }}
      />
      <Tabs.Screen
        name="global-admin/index"
        options={{
          title: "Admin Global",
          href: null,
        }}
      />
      <Tabs.Screen
        name="church/index"
        options={{
          title: "Dados da Igreja",
          tabBarLabel: "Igreja",
          tabBarIcon: ({ color }) => tabIcon(Church, color),
          href: canAccessChurchAdmin(user?.role) ? ("/church" as never) : null,
        }}
      />
      <Tabs.Screen
        name="instruments/index"
        options={{
          title: "Instrumentos/Cargos",
          href: null,
          headerLeft: () => null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          href: null,
        }}
      />
    </Tabs>
  );
}
