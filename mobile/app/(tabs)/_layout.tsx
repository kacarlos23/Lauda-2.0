import { Redirect, Tabs, usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, Text, View } from "react-native";
import { useAuthStore } from "../../src/store/authStore";
import { ProfileHeaderButton } from "../../src/components/ProfileHeaderButton";
import { BrandLogo } from "../../src/components/BrandLogo";
import { NotificationBell } from "../../src/components/NotificationBell";
import { NotificationRuntime } from "../../src/components/NotificationRuntime";
import { NotificationToast } from "../../src/components/NotificationToast";
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
  SidebarNavigation,
} from "../../src/components/SidebarNavigation";
import { colors, controlSizes, fontSizes, fontWeights, iconSizes, spacing, typography } from "../../src/theme";
import { useResponsiveLayout } from "../../src/hooks/useResponsiveLayout";
import {
  activeMobileTabIndex,
  hrefForNavigationItem,
  navigationItemsFor,
} from "../../src/navigation/manifest";
import { GROUP_HREFS, ROUTES, TAB_ROUTE_KEYS } from "../../src/navigation/routes";
import {
  AnimatedTabBubble,
  AnimatedTabIcon,
  AnimatedTabLabel,
} from "../../src/components/AnimatedTabNavigation";

function MobileTabBubbleBackground() {
  const user = useAuthStore((state) => state.user);
  const { screenWidth } = useResponsiveLayout();
  const tabItems = navigationItemsFor("mobile-tab", user);
  const moreItems = navigationItemsFor("mobile-more", user);

  return (
    <AnimatedTabBubble
      key={screenWidth}
      tabItems={tabItems}
      moreItems={moreItems}
    />
  );
}

function renderMobileTabBubbleBackground() {
  return <MobileTabBubbleBackground />;
}

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
  const mobileMoreItems = navigationItemsFor("mobile-more", user);
  const selectedMobileTabIndex = activeMobileTabIndex(pathname, mobileTabItems, mobileMoreItems);
  const selectedMobileTabId = mobileTabItems[selectedMobileTabIndex]?.id;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <NotificationRuntime />
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
          tabBarItemStyle: { flex: 1, minWidth: 0 },
          tabBarBackground: showSidebar
            ? undefined
            : renderMobileTabBubbleBackground,
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
          headerRight: () => <View style={styles.headerActions}>{user.tenantId ? <NotificationBell /> : null}<ProfileHeaderButton /></View>,
        }}
      >
        {TAB_ROUTE_KEYS.map((routeKey) => {
          const route = ROUTES[routeKey];
          const navigationItem = mobileTabItems.find((item) => item.route === routeKey);
          const visuallySelected = navigationItem?.id === selectedMobileTabId;
          return (
            <Tabs.Screen
              key={routeKey}
              name={route.expoScreen}
              options={{
                title: route.title,
                href: navigationItem ? hrefForNavigationItem(navigationItem) : null,
                tabBarLabel: navigationItem
                  ? ({ focused }) => (
                      <AnimatedTabLabel
                        focused={focused || visuallySelected}
                        label={navigationItem.label}
                        itemId={navigationItem.id}
                      />
                    )
                  : undefined,
                tabBarIcon: navigationItem
                  ? ({ focused }) => (
                      <AnimatedTabIcon
                        Icon={navigationItem.Icon}
                        focused={focused || visuallySelected}
                        itemId={navigationItem.id}
                      />
                    )
                  : undefined,
                ...("hideHeaderBack" in route && route.hideHeaderBack
                  ? { headerLeft: () => null }
                  : {}),
              }}
            />
          );
        })}
      </Tabs>
      <NotificationToast />
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
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginRight: spacing.sm },
});
