import { requestFormNavigation } from "../../src/navigation/formExitGuard";
import { Redirect, Tabs, usePathname, useRouter } from "expo-router";
import { PlatformPressable } from "@react-navigation/elements";
import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, Platform, StyleSheet, Text, View } from "react-native";
import { useAuthStore } from "../../src/store/authStore";
import { isPublicTestEnvironment } from "../../src/components/TestEnvironmentBanner";
import { useSafeInsets } from "../../src/hooks/useSafeInsets";
import { ProfileHeaderButton } from "../../src/components/ProfileHeaderButton";
import { BrandLogo } from "../../src/components/BrandLogo";
import { NotificationBell } from "../../src/components/NotificationBell";
import { ThemeToggle } from "../../src/components/ThemeControls";
import { NotificationRuntime } from "../../src/components/NotificationRuntime";
import { NotificationToast } from "../../src/components/NotificationToast";
import { useInstallStore } from "../../src/features/install/installStore";
import { OnboardingOverlay } from "../../src/features/onboarding/OnboardingOverlay";
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
  SidebarNavigation,
} from "../../src/components/SidebarNavigation";
import { colors, controlSizes, fontSizes, fontWeights, iconSizes, radiusValues, spacing, typography } from "../../src/theme";
import { useReducedMotion } from "../../src/hooks/useReducedMotion";
import { useResponsiveLayout } from "../../src/hooks/useResponsiveLayout";
import {
  activeMobileTabIndex,
  hrefForNavigationItem,
  navigationItemsFor,
} from "../../src/navigation/manifest";
import { GROUP_HREFS, ROUTES, TAB_ROUTE_KEYS } from "../../src/navigation/routes";
import { stagingNavigationEnabled } from "../../src/tokens/stagingNavigation";
import { StagingDockClearance } from "../../src/navigation/stagingDockClearance";
import { stagingScreenTransitionOptions } from "../../src/navigation/stagingTransitions";
import {
  DOCK_BOTTOM_GAP,
  DOCK_HEIGHT,
  DOCK_HORIZONTAL_INSET,
  DOCK_PADDING_X,
  DOCK_PADDING_Y,
  StagingDockSurface,
} from "../../src/components/StagingDockSurface";
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

function renderMobileDockBackground() {
  return <StagingDockSurface />;
}

export default function TabsLayout() {
  const router = useRouter();
  const { user, tenant, isLoading, refreshCurrentUser } = useAuthStore();
  const { isMobile, isTablet, isDesktop } = useResponsiveLayout();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const safeArea = useSafeInsets();
  const reducedMotion = useReducedMotion();
  const updateAvailable = useInstallStore((state) => state.updateAvailable);

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
  const stagingWeb = stagingNavigationEnabled && Platform.OS === "web";
  const showDock = stagingNavigationEnabled && isMobile;
  const dockBottom = DOCK_BOTTOM_GAP + safeArea.bottom;
  const dockClearance = showDock ? DOCK_HEIGHT + dockBottom : 0;
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
          indicatorStyle={stagingWeb && isDesktop}
        />
      ) : null}

      <StagingDockClearance.Provider value={dockClearance}>
        <View
          testID={stagingWeb && isDesktop ? "staging-desktop-content" : undefined}
          style={[styles.contentShell, { marginLeft: showSidebar ? sidebarWidth : 0 }]}
        >
          <Tabs
            backBehavior="fullHistory"
            screenOptions={{
              ...stagingScreenTransitionOptions(stagingWeb, reducedMotion),
              sceneStyle: {
                backgroundColor: colors.background,
              },
            tabBarStyle: showSidebar
              ? { display: "none" }
              : showDock ? [styles.dockTabBar, { bottom: dockBottom }] : {
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
              : showDock ? renderMobileDockBackground : renderMobileTabBubbleBackground,
            headerShown: true,
            ...(Platform.OS !== "web" && isPublicTestEnvironment ? { headerStatusBarHeight: 0 } : {}),
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
            headerRight: () => <View style={styles.headerActions}><ThemeToggle />{user.tenantId ? <NotificationBell /> : null}<ProfileHeaderButton /></View>,
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
                  ...(navigationItem ? {
                    tabBarButton: (props) => (
                      <PlatformPressable
                        {...props}
                        {...(showDock ? {
                          testID: `staging-dock-tab-${navigationItem.id}`,
                          ...(Platform.OS === "web" ? { "aria-selected": visuallySelected } : {}),
                          accessibilityState: { selected: visuallySelected },
                          style: [props.style, styles.dockButton],
                        } : {})}
                        onPress={(event) => {
                          event.preventDefault();
                          requestFormNavigation(() => router.navigate(hrefForNavigationItem(navigationItem)));
                        }}
                      />
                    ),
                  } : { href: null }),
                  tabBarLabel: navigationItem
                    ? ({ focused }) => showDock ? (
                        <Text numberOfLines={1} style={[styles.dockLabel, visuallySelected && styles.dockLabelActive]}>
                          {navigationItem.label}
                        </Text>
                      ) : (
                        <AnimatedTabLabel
                          focused={focused || visuallySelected}
                          label={navigationItem.label}
                          itemId={navigationItem.id}
                        />
                      )
                    : undefined,
                  tabBarIcon: navigationItem
                    ? ({ focused }) => {
                        const icon = showDock ? (
                          <navigationItem.Icon
                            color={visuallySelected ? colors.primary : colors.muted}
                            size={iconSizes.s22}
                            strokeWidth={2}
                          />
                        ) : (
                          <AnimatedTabIcon
                            Icon={navigationItem.Icon}
                            focused={focused || visuallySelected}
                            itemId={navigationItem.id}
                          />
                        );
                        if (navigationItem.id !== "more" || !updateAvailable) {
                          return icon;
                        }
                        return (
                          <View style={styles.tabIconWrap}>
                            {icon}
                            <View style={styles.updateDot} testID="tab-more-update-badge" />
                          </View>
                        );
                      }
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
        <OnboardingOverlay />
      </StagingDockClearance.Provider>
      <NotificationToast />
    </View>
  );
}

const styles = StyleSheet.create({
  contentShell: {
    flex: 1,
    minWidth: 0,
  },
  dockTabBar: {
    position: "absolute",
    start: DOCK_HORIZONTAL_INSET,
    end: DOCK_HORIZONTAL_INSET,
    height: DOCK_HEIGHT,
    paddingHorizontal: DOCK_PADDING_X,
    paddingTop: DOCK_PADDING_Y,
    paddingBottom: DOCK_PADDING_Y,
    zIndex: 10,
    borderTopWidth: 0,
    backgroundColor: "transparent",
    borderRadius: radiusValues.r26,
    elevation: 0,
    shadowOpacity: 0,
  },
  dockButton: {
    width: "100%",
    minHeight: controlSizes.large,
    borderRadius: radiusValues.r16,
    alignItems: "center",
    justifyContent: "center",
  },
  dockLabel: {
    color: colors.muted,
    fontSize: fontSizes.s11,
    fontWeight: fontWeights.semibold,
  },
  dockLabelActive: {
    color: colors.primary,
    fontWeight: fontWeights.bold,
  },
  tabIconWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  updateDot: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
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
