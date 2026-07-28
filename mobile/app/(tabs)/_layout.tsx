import { Redirect, Tabs, usePathname } from "expo-router";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, Text, View } from "react-native";
import { useAuthStore } from "../../src/store/authStore";
import { ProfileHeaderButton } from "../../src/components/ProfileHeaderButton";
import { BrandLogo } from "../../src/components/BrandLogo";
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
  SidebarNavigation,
} from "../../src/components/SidebarNavigation";
import { colors, controlSizes, fontSizes, fontWeights, iconSizes, spacing, typography } from "../../src/theme";
import { useResponsiveLayout } from "../../src/hooks/useResponsiveLayout";
import {
  hrefForNavigationItem,
  navigationItemsFor,
  type NavigationIconProps,
} from "../../src/navigation/manifest";
import { GROUP_HREFS, ROUTES, TAB_ROUTE_KEYS } from "../../src/navigation/routes";

const tabIcon = (Icon: ComponentType<NavigationIconProps>, color: string) => (
  <Icon color={color} size={iconSizes.s22} strokeWidth={2.4} />
);

export default function TabsLayout() {
  const { user, tenant, isLoading, refreshCurrentUser } = useAuthStore();
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

  if (isLoading) {
    return (
      <View style={styles.sessionLoading} accessibilityLabel="Carregando sessão">
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href={GROUP_HREFS.auth} />;
  }

  const showSidebar = !isMobile;
  const sidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;
  const mobileTabItems = navigationItemsFor("mobile-tab", user);

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
                height: controlSizes.tabBar,
                paddingTop: spacing.sm,
                paddingBottom: spacing.sm,
              },
          tabBarActiveTintColor: colors.inverse,
          tabBarInactiveTintColor: colors.inverseMeta,
          tabBarLabelStyle: { fontSize: fontSizes.s11, fontWeight: fontWeights.semibold },
          headerShown: true,
          headerStyle: { backgroundColor: colors.surface },
          headerShadowVisible: false,
          headerTintColor: colors.ink,
          headerTitle: () => !isMobile ? (
            <Text style={styles.tenantName} numberOfLines={1}>{tenant?.name ?? "Lauda"}</Text>
          ) : null,
          headerLeft: () => isMobile ? (
            <View style={{ marginLeft: spacing.lg }}>
              <BrandLogo variant="symbol" width={32} />
            </View>
          ) : null,
          headerRight: () => <ProfileHeaderButton />,
        }}
      >
        {TAB_ROUTE_KEYS.map((routeKey) => {
          const route = ROUTES[routeKey];
          const navigationItem = mobileTabItems.find((item) => item.route === routeKey);
          return (
            <Tabs.Screen
              key={routeKey}
              name={route.expoScreen}
              options={{
                title: route.title,
                href: navigationItem ? hrefForNavigationItem(navigationItem) : null,
                tabBarLabel: navigationItem?.label,
                tabBarIcon: navigationItem
                  ? ({ color }) => tabIcon(navigationItem.Icon, color)
                  : undefined,
                ...("hideHeaderBack" in route && route.hideHeaderBack
                  ? { headerLeft: () => null }
                  : {}),
              }}
            />
          );
        })}
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  sessionLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  tenantName: {
    ...typography.eyebrow,
    color: colors.primaryDark,
    textTransform: "uppercase",
  },
});
