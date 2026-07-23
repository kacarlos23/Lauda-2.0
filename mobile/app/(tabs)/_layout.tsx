import { Redirect, Tabs, usePathname } from "expo-router";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { CalendarClock, Church, Ellipsis, Home, Music2, Users } from "lucide-react-native";
import { useAuthStore } from "../../src/store/authStore";
import { ProfileHeaderButton } from "../../src/components/ProfileHeaderButton";
import { BrandLogo } from "../../src/components/BrandLogo";
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
  SidebarNavigation,
} from "../../src/components/SidebarNavigation";
import { colors, spacing, typography } from "../../src/theme";
import { useResponsiveLayout } from "../../src/hooks/useResponsiveLayout";
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
  const { user, tenant, refreshCurrentUser } = useAuthStore();
  const { isMobile, isTablet } = useResponsiveLayout();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshCurrentUser();
    });
    return () => subscription.remove();
  }, [refreshCurrentUser]);

  useEffect(() => {
    if (isTablet) setSidebarCollapsed(true);
  }, [isTablet]);

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  const showSidebar = !isMobile;
  const sidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {showSidebar ? (
        <SidebarNavigation
          isCollapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((current) => !current)}
          currentRoute={pathname}
        />
      ) : null}

      <Tabs
        screenOptions={{
          sceneStyle: {
            backgroundColor: colors.background,
            marginLeft: showSidebar ? sidebarWidth : 0,
          },
          tabBarStyle: showSidebar
            ? { display: "none" }
            : {
                backgroundColor: colors.surfaceDark,
                borderTopWidth: 1,
                borderTopColor: colors.primaryDark,
                height: 72,
                paddingTop: spacing.sm,
                paddingBottom: spacing.sm,
              },
          tabBarActiveTintColor: colors.inverse,
          tabBarInactiveTintColor: "#93A79E",
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
          headerShown: true,
          headerStyle: { backgroundColor: colors.surface },
          headerShadowVisible: false,
          headerTintColor: colors.ink,
          headerTitle: () => !isMobile ? (
            <Text style={styles.tenantName} numberOfLines={1}>{tenant?.name ?? "Lauda"}</Text>
          ) : null,
          headerLeft: () => isMobile ? (
            <View style={{ marginLeft: 16 }}>
              <BrandLogo variant="symbol" width={32} />
            </View>
          ) : null,
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
            href: !isMobile && canViewMembers(user) ? "/members" : null,
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
          name="more"
          options={{
            title: "Mais",
            tabBarLabel: "Mais",
            tabBarIcon: ({ color }) => tabIcon(Ellipsis, color),
            href: "/more" as never,
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
            href: !isMobile && canAccessChurchAdmin(user) ? ("/church" as never) : null,
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
    </View>
  );
}

const styles = StyleSheet.create({
  tenantName: {
    ...typography.eyebrow,
    color: colors.primaryDark,
    textTransform: "uppercase",
  },
});
