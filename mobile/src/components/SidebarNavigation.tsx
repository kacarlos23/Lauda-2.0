import { requestFormNavigation } from "../navigation/formExitGuard";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { router } from "expo-router";
import {
  ChevronsLeft,
  ChevronsRight,
  LogOut,
} from "lucide-react-native";
import {
  colors,
  controlSizes,
  fontSizes,
  fontWeights,
  iconSizes,
  motion,
  overlays,
  radiusValues,
  spacing,
  typography,
  zIndices,
} from "../theme";
import { useAuthStore } from "../store/authStore";
import { formatRoleLabel } from "../utils/permissions";
import {
  hrefForNavigationItem,
  navigationItemsFor,
  routeMatches,
  SIDEBAR_GROUPS,
} from "../navigation/manifest";
import { nav, ROUTES } from "../navigation/routes";
import { desktopIndicatorEasing, stagingTransitionMs } from "../tokens/stagingNavigation";
import { BrandLogo } from "./BrandLogo";
import { useReducedMotion } from "../hooks/useReducedMotion";

export const SIDEBAR_COLLAPSED_WIDTH = 72;
export const SIDEBAR_EXPANDED_WIDTH = 248;
export const SIDEBAR_ANIMATION_MS = 220;

function navTestId(href: string): string {
  return `sidebar-nav-${href === "/" ? "home" : href.replace(/^\//, "").replace(/\//g, "-")}`;
}

type SidebarNavigationProps = {
  isCollapsed: boolean;
  onToggle: () => void;
  currentRoute: string;
  indicatorStyle?: boolean;
};

function getInitials(name?: string): string {
  const parts = (name ?? "Usuário").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";
}

function SidebarNavigationComponent({ isCollapsed, onToggle, currentRoute, indicatorStyle = false }: SidebarNavigationProps) {
  const { user, logout } = useAuthStore();
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [activeRailVisible, setActiveRailVisible] = useState(false);
  const labelOpacity = useRef(new Animated.Value(isCollapsed ? 0 : 1)).current;
  const activeRailY = useRef(new Animated.Value(0)).current;
  const activeRailInitialized = useRef(false);
  const groupOffsets = useRef(new Map<string, number>());
  const itemOffsets = useRef(new Map<string, number>());
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    Animated.timing(labelOpacity, {
      toValue: isCollapsed ? 0 : 1,
      duration: indicatorStyle
        ? (reducedMotion ? motion.reducedMs : stagingTransitionMs.sidebarWidth)
        : SIDEBAR_ANIMATION_MS,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [indicatorStyle, isCollapsed, labelOpacity, reducedMotion]);

  const visibleItems = useMemo(
    () => navigationItemsFor("desktop-sidebar", user),
    [user]
  );
  const activeItem = useMemo(
    () => visibleItems.find((item) => routeMatches(currentRoute, item.route)),
    [currentRoute, visibleItems]
  );
  const width = isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  const rememberOffset = useCallback(
    (offsets: Map<string, number>, key: string, event: LayoutChangeEvent) => {
      const nextOffset = event.nativeEvent.layout.y;
      if (offsets.get(key) === nextOffset) return;
      offsets.set(key, nextOffset);
      setLayoutVersion((current) => current + 1);
    },
    []
  );

  useEffect(() => {
    if (!activeItem?.sidebarGroup) {
      setActiveRailVisible(false);
      return;
    }

    const groupOffset = groupOffsets.current.get(activeItem.sidebarGroup);
    const itemOffset = itemOffsets.current.get(activeItem.id);
    if (groupOffset === undefined || itemOffset === undefined) return;

    const nextPosition = groupOffset + itemOffset;
    setActiveRailVisible(true);

    if (!activeRailInitialized.current) {
      activeRailY.setValue(nextPosition);
      activeRailInitialized.current = true;
      return;
    }

    const animation = Animated.timing(activeRailY, {
      toValue: nextPosition,
      duration: reducedMotion
        ? motion.reducedMs
        : indicatorStyle
          ? stagingTransitionMs.sidebarIndicator
          : motion.navigationSelectionMs,
      easing: indicatorStyle ? Easing.bezier(...desktopIndicatorEasing) : Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();

    return () => animation.stop();
  }, [
    activeItem?.id,
    activeItem?.sidebarGroup,
    activeRailY,
    indicatorStyle,
    isCollapsed,
    layoutVersion,
    reducedMotion,
  ]);

  return (
    <View
      style={[styles.sidebar, indicatorStyle && styles.indicatorSidebar, { width }]}
      accessibilityLabel="Menu principal"
      testID={indicatorStyle ? "staging-indicator-sidebar" : undefined}
    >
      <View style={[styles.header, isCollapsed && styles.headerCollapsed, indicatorStyle && styles.indicatorBorder]}>
        <BrandLogo
          variant={isCollapsed ? "symbol" : "horizontal"}
          tone={indicatorStyle ? undefined : "light"}
          width={isCollapsed ? 34 : 132}
        />
        <Pressable
          onPress={onToggle}
          hitSlop={8}
          style={({ pressed }) => [styles.toggleButton, indicatorStyle && styles.indicatorBorder, pressed && styles.pressed]}
          testID={indicatorStyle ? "staging-indicator-sidebar-toggle" : undefined}
          accessibilityRole="button"
          accessibilityLabel={isCollapsed ? "Expandir menu" : "Recolher menu"}
        >
          {isCollapsed ? (
            <ChevronsRight color={indicatorStyle ? colors.ink : colors.inverse} size={iconSizes.s18} strokeWidth={2} />
          ) : (
            <ChevronsLeft color={indicatorStyle ? colors.ink : colors.inverse} size={iconSizes.s18} strokeWidth={2} />
          )}
        </Pressable>
      </View>

      <View style={styles.navList}>
        {activeRailVisible && indicatorStyle ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicatorActiveBackdrop,
              { transform: [{ translateY: activeRailY }] },
            ]}
            testID="staging-sidebar-active-backdrop"
          />
        ) : null}
        {activeRailVisible ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activeRail,
              indicatorStyle && styles.indicatorRail,
              { transform: [{ translateY: activeRailY }] },
            ]}
            testID="sidebar-active-rail"
          />
        ) : null}
        {SIDEBAR_GROUPS.map((group) => {
          const groupItems = visibleItems.filter((item) => item.sidebarGroup === group);
          if (!groupItems.length) return null;
          return (
            <View
              key={group}
              style={[styles.group, indicatorStyle && styles.indicatorGroup]}
              onLayout={(event) => rememberOffset(groupOffsets.current, group, event)}
            >
              {isCollapsed ? (
                <View style={[styles.groupDivider, indicatorStyle && styles.indicatorDivider]} />
              ) : (
                <Animated.Text style={[styles.groupLabel, indicatorStyle && styles.indicatorMuted, { opacity: labelOpacity }]}>
                  {group}
                </Animated.Text>
              )}
              {groupItems.map((item) => {
                const href = hrefForNavigationItem(item);
                const hrefText = ROUTES[item.route].path;
                const active = routeMatches(currentRoute, item.route);
                const iconColor = indicatorStyle
                  ? active ? colors.primary : colors.muted
                  : active ? colors.inverse : colors.inverseMuted;
                return (
                  <View
                    key={item.id}
                    style={styles.itemWrapper}
                    onLayout={(event) => rememberOffset(itemOffsets.current, item.id, event)}
                  >
                    <Pressable
                      onPress={() => requestFormNavigation(() => router.push(href))}
                      onHoverIn={() => setHoveredLabel(item.label)}
                      onHoverOut={() => setHoveredLabel(null)}
                      style={(state) => [
                        styles.navItem,
                        isCollapsed && styles.navItemCollapsed,
                        active && (indicatorStyle ? !activeRailVisible && styles.indicatorItemActive : styles.navItemActive),
                        hoveredLabel === item.label && !active && (indicatorStyle ? styles.indicatorItemHover : styles.navItemHover),
                        state.pressed && styles.pressed,
                      ]}
                      accessibilityRole="link"
                      accessibilityLabel={item.label}
                      accessibilityState={{ selected: active }}
                      testID={navTestId(hrefText)}
                    >
                      <item.Icon color={iconColor} size={iconSizes.s20} strokeWidth={2} />
                      {!isCollapsed ? (
                        <Animated.Text style={[
                          styles.navLabel,
                          active && styles.navLabelActive,
                          indicatorStyle && (active ? styles.indicatorLabelActive : styles.indicatorMuted),
                          { opacity: labelOpacity },
                        ]}>
                          {item.label}
                        </Animated.Text>
                      ) : null}
                    </Pressable>
                    {isCollapsed && hoveredLabel === item.label ? (
                      <View style={styles.tooltip} pointerEvents="none">
                        <Text style={styles.tooltipText}>{item.label}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>

      <View style={[styles.footer, indicatorStyle && styles.indicatorBorder]}>
        <Pressable
          onPress={() => requestFormNavigation(() => router.push(nav.profile))}
          onHoverIn={() => setHoveredLabel("__profile")}
          onHoverOut={() => setHoveredLabel(null)}
          style={({ pressed }) => [
            styles.profileButton,
            isCollapsed && styles.profileButtonCollapsed,
            hoveredLabel === "__profile" && (indicatorStyle ? styles.indicatorItemHover : styles.navItemHover),
            pressed && styles.pressed,
          ]}
          accessibilityRole="link"
          accessibilityLabel="Abrir perfil"
        >
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
            </View>
          )}
          {!isCollapsed ? (
            <Animated.View style={[styles.userCopy, { opacity: labelOpacity }]}>
              <Text style={[styles.userName, indicatorStyle && styles.indicatorInk]} numberOfLines={1}>{user?.name ?? "Usuário"}</Text>
              <Text style={[styles.userRole, indicatorStyle && styles.indicatorMuted]} numberOfLines={1}>{formatRoleLabel(user?.role)}</Text>
            </Animated.View>
          ) : null}
        </Pressable>
        <Pressable
          onPress={() => requestFormNavigation(() => void logout())}
          onHoverIn={() => setHoveredLabel("__logout")}
          onHoverOut={() => setHoveredLabel(null)}
          style={({ pressed }) => [
            styles.logoutButton,
            isCollapsed && styles.navItemCollapsed,
            hoveredLabel === "__logout" && styles.logoutHover,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
        >
          <LogOut color={indicatorStyle ? colors.danger : colors.dangerOnDark} size={iconSizes.s20} strokeWidth={2} />
          {!isCollapsed ? (
            <Animated.Text style={[styles.logoutText, indicatorStyle && styles.indicatorDanger, { opacity: labelOpacity }]}>Sair</Animated.Text>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

export const SidebarNavigation = memo(SidebarNavigationComponent);

const styles = StyleSheet.create({
  sidebar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: zIndices.sidebar,
    overflow: "visible",
    backgroundColor: colors.surfaceDark,
    borderRightWidth: 1,
    borderRightColor: colors.primaryDark,
  },
  header: {
    minHeight: 80,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: overlays.inverseBorder,
  },
  headerCollapsed: {
    minHeight: 112,
    flexDirection: "column",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  toggleButton: {
    width: controlSizes.compact,
    height: controlSizes.compact,
    borderRadius: radiusValues.r6,
    borderWidth: 1,
    borderColor: overlays.inverseControlBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  navList: {
    flex: 1,
    paddingTop: spacing.md,
  },
  group: {
    paddingVertical: spacing.sm,
  },
  groupLabel: {
    ...typography.eyebrow,
    color: colors.inverseFaint,
    textTransform: "uppercase",
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xs,
  },
  groupDivider: {
    width: 24,
    height: 1,
    alignSelf: "center",
    backgroundColor: overlays.inverseBorder,
    marginBottom: spacing.xs,
  },
  itemWrapper: {
    position: "relative",
  },
  navItem: {
    minHeight: controlSizes.default,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    position: "relative",
  },
  navItemCollapsed: {
    justifyContent: "center",
    paddingHorizontal: 0,
  },
  navItemActive: {
    backgroundColor: overlays.activeNavigation,
  },
  navItemHover: {
    backgroundColor: overlays.subtleInverse,
  },
  activeRail: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 1,
    width: 3,
    height: controlSizes.default,
    backgroundColor: colors.accent,
  },
  navLabel: {
    flex: 1,
    color: colors.inverseText,
    fontSize: fontSizes.s13,
    fontWeight: fontWeights.semibold,
  },
  navLabelActive: {
    color: colors.inverse,
  },
  tooltip: {
    position: "absolute",
    left: SIDEBAR_COLLAPSED_WIDTH + 8,
    top: 4,
    zIndex: zIndices.tooltip,
    minHeight: controlSizes.compact,
    justifyContent: "center",
    borderRadius: radiusValues.r6,
    backgroundColor: colors.brandInk,
    paddingHorizontal: spacing.md,
  },
  tooltipText: {
    ...typography.label,
    color: colors.inverse,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: overlays.inverseBorder,
    paddingVertical: spacing.sm,
  },
  profileButton: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  profileButtonCollapsed: {
    justifyContent: "center",
    paddingHorizontal: 0,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: radiusValues.r17,
    backgroundColor: colors.primary,
  },
  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: radiusValues.r17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: overlays.inverseAvatarBorder,
  },
  avatarText: {
    color: colors.inverse,
    fontSize: fontSizes.s11,
    fontWeight: fontWeights.bold,
  },
  userCopy: { flex: 1 },
  userName: { color: colors.inverse, fontSize: fontSizes.s12, fontWeight: fontWeights.semibold },
  userRole: { color: colors.inverseMeta, fontSize: fontSizes.s11, marginTop: spacing.xxs },
  logoutButton: {
    minHeight: controlSizes.default,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  logoutHover: {
    backgroundColor: overlays.dangerSurface,
  },
  logoutText: { color: colors.dangerOnDark, fontSize: fontSizes.s13, fontWeight: fontWeights.semibold },
  indicatorSidebar: { backgroundColor: colors.surface, borderRightColor: colors.line },
  indicatorGroup: { paddingVertical: spacing.xs },
  indicatorBorder: { borderColor: colors.line },
  indicatorDivider: { backgroundColor: colors.line },
  indicatorInk: { color: colors.ink },
  indicatorMuted: { color: colors.muted },
  indicatorDanger: { color: colors.danger },
  indicatorItemActive: { backgroundColor: colors.primarySoft },
  indicatorActiveBackdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: controlSizes.default,
    backgroundColor: colors.primarySoft,
  },
  indicatorItemHover: { backgroundColor: colors.surfaceMuted },
  indicatorLabelActive: { color: colors.primary },
  indicatorRail: {
    top: 4,
    width: 3.5,
    height: controlSizes.default - 8,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: colors.primary,
  },
  pressed: { opacity: 0.7 },
});
