import React, { type ComponentType, memo, useEffect, useRef, useState } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import {
  CalendarClock,
  ChevronsLeft,
  ChevronsRight,
  Church,
  Home,
  LogOut,
  Music2,
  User,
  Users,
} from "lucide-react-native";
import { colors, spacing, typography } from "../theme";
import { useAuthStore } from "../store/authStore";
import { canAccessChurchAdmin, canViewMembers, formatRoleLabel } from "../utils/permissions";
import { BrandLogo } from "./BrandLogo";

export const SIDEBAR_COLLAPSED_WIDTH = 72;
export const SIDEBAR_EXPANDED_WIDTH = 248;
export const SIDEBAR_ANIMATION_MS = 220;

type IconProps = {
  color?: string;
  size?: number;
  strokeWidth?: number;
};

type SidebarGroup = "Visão geral" | "Operação" | "Pessoas" | "Configurações";

type SidebarItem = {
  group: SidebarGroup;
  label: string;
  href: string;
  routePrefix: string;
  Icon: ComponentType<IconProps>;
  visible?: boolean;
};

function navTestId(href: string): string {
  return `sidebar-nav-${href === "/" ? "home" : href.replace(/^\//, "").replace(/\//g, "-")}`;
}

type SidebarNavigationProps = {
  isCollapsed: boolean;
  onToggle: () => void;
  currentRoute: string;
};

function routeMatches(currentRoute: string, prefix: string): boolean {
  if (prefix === "/") return currentRoute === "/" || currentRoute === "/(tabs)" || currentRoute === "/(tabs)/";
  return currentRoute === prefix || currentRoute.startsWith(`${prefix}/`);
}

function getInitials(name?: string): string {
  const parts = (name ?? "Usuário").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";
}

function SidebarNavigationComponent({ isCollapsed, onToggle, currentRoute }: SidebarNavigationProps) {
  const { user, logout } = useAuthStore();
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const labelOpacity = useRef(new Animated.Value(isCollapsed ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(labelOpacity, {
      toValue: isCollapsed ? 0 : 1,
      duration: SIDEBAR_ANIMATION_MS,
      useNativeDriver: true,
    }).start();
  }, [isCollapsed, labelOpacity]);

  const items: SidebarItem[] = [
    { group: "Visão geral", label: "Início", href: "/", routePrefix: "/", Icon: Home },
    { group: "Operação", label: "Escalas", href: "/schedules", routePrefix: "/schedules", Icon: CalendarClock },
    { group: "Operação", label: "Ministérios", href: "/ministries", routePrefix: "/ministries", Icon: Church },
    { group: "Operação", label: "Músicas", href: "/songs", routePrefix: "/songs", Icon: Music2 },
    { group: "Pessoas", label: "Membros", href: "/members", routePrefix: "/members", Icon: Users, visible: canViewMembers(user) },
    { group: "Configurações", label: "Igreja", href: "/church", routePrefix: "/church", Icon: Church, visible: canAccessChurchAdmin(user) },
    { group: "Configurações", label: "Perfil", href: "/profile", routePrefix: "/profile", Icon: User },
  ];

  const groups: SidebarGroup[] = ["Visão geral", "Operação", "Pessoas", "Configurações"];
  const visibleItems = items.filter((item) => item.visible !== false);
  const width = isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  return (
    <View style={[styles.sidebar, { width }]} accessibilityLabel="Menu principal">
      <View style={[styles.header, isCollapsed && styles.headerCollapsed]}>
        <BrandLogo
          variant={isCollapsed ? "symbol" : "horizontal"}
          tone="light"
          width={isCollapsed ? 34 : 132}
        />
        <Pressable
          onPress={onToggle}
          hitSlop={8}
          style={({ pressed }) => [styles.toggleButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={isCollapsed ? "Expandir menu" : "Recolher menu"}
        >
          {isCollapsed ? (
            <ChevronsRight color={colors.inverse} size={18} strokeWidth={2} />
          ) : (
            <ChevronsLeft color={colors.inverse} size={18} strokeWidth={2} />
          )}
        </Pressable>
      </View>

      <View style={styles.navList}>
        {groups.map((group) => {
          const groupItems = visibleItems.filter((item) => item.group === group);
          if (!groupItems.length) return null;
          return (
            <View key={group} style={styles.group}>
              {isCollapsed ? (
                <View style={styles.groupDivider} />
              ) : (
                <Animated.Text style={[styles.groupLabel, { opacity: labelOpacity }]}>
                  {group}
                </Animated.Text>
              )}
              {groupItems.map((item) => {
                const active = routeMatches(currentRoute, item.routePrefix);
                const iconColor = active ? colors.inverse : "#AFC0B8";
                return (
                  <View key={item.href} style={styles.itemWrapper}>
                    <Pressable
                      onPress={() => router.push(item.href as never)}
                      onHoverIn={() => setHoveredLabel(item.label)}
                      onHoverOut={() => setHoveredLabel(null)}
                      style={(state) => [
                        styles.navItem,
                        isCollapsed && styles.navItemCollapsed,
                        active && styles.navItemActive,
                        state.hovered && !active && styles.navItemHover,
                        state.pressed && styles.pressed,
                      ]}
                      accessibilityRole="link"
                      accessibilityLabel={item.label}
                      accessibilityState={{ selected: active }}
                      testID={navTestId(item.href)}
                    >
                      <View style={[styles.activeRail, active && styles.activeRailVisible]} />
                      <item.Icon color={iconColor} size={20} strokeWidth={2} />
                      {!isCollapsed ? (
                        <Animated.Text style={[styles.navLabel, active && styles.navLabelActive, { opacity: labelOpacity }]}>
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

      <View style={styles.footer}>
        <Pressable
          onPress={() => router.push("/profile" as never)}
          style={({ pressed, hovered }) => [
            styles.profileButton,
            isCollapsed && styles.profileButtonCollapsed,
            hovered && styles.navItemHover,
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
              <Text style={styles.userName} numberOfLines={1}>{user?.name ?? "Usuário"}</Text>
              <Text style={styles.userRole} numberOfLines={1}>{formatRoleLabel(user?.role)}</Text>
            </Animated.View>
          ) : null}
        </Pressable>
        <Pressable
          onPress={() => void logout()}
          style={({ pressed, hovered }) => [
            styles.logoutButton,
            isCollapsed && styles.navItemCollapsed,
            hovered && styles.logoutHover,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
        >
          <LogOut color="#E7A28F" size={20} strokeWidth={2} />
          {!isCollapsed ? (
            <Animated.Text style={[styles.logoutText, { opacity: labelOpacity }]}>Sair</Animated.Text>
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
    zIndex: 20,
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
    borderBottomColor: "rgba(248, 250, 246, 0.12)",
  },
  headerCollapsed: {
    minHeight: 112,
    flexDirection: "column",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  toggleButton: {
    width: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(248, 250, 246, 0.18)",
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
    color: "#82998E",
    textTransform: "uppercase",
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xs,
  },
  groupDivider: {
    width: 24,
    height: 1,
    alignSelf: "center",
    backgroundColor: "rgba(248, 250, 246, 0.12)",
    marginBottom: spacing.xs,
  },
  itemWrapper: {
    position: "relative",
  },
  navItem: {
    minHeight: 44,
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
    backgroundColor: "rgba(31, 111, 85, 0.38)",
  },
  navItemHover: {
    backgroundColor: "rgba(248, 250, 246, 0.07)",
  },
  activeRail: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  activeRailVisible: {
    backgroundColor: colors.accent,
  },
  navLabel: {
    flex: 1,
    color: "#C6D2CC",
    fontSize: 13,
    fontWeight: "600",
  },
  navLabelActive: {
    color: colors.inverse,
  },
  tooltip: {
    position: "absolute",
    left: SIDEBAR_COLLAPSED_WIDTH + 8,
    top: 4,
    zIndex: 40,
    minHeight: 36,
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: colors.brandInk,
    paddingHorizontal: spacing.md,
  },
  tooltipText: {
    ...typography.label,
    color: colors.inverse,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "rgba(248, 250, 246, 0.12)",
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
    borderRadius: 17,
    backgroundColor: colors.primary,
  },
  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: "rgba(248, 250, 246, 0.2)",
  },
  avatarText: {
    color: colors.inverse,
    fontSize: 11,
    fontWeight: "700",
  },
  userCopy: { flex: 1 },
  userName: { color: colors.inverse, fontSize: 12, fontWeight: "600" },
  userRole: { color: "#93A79E", fontSize: 11, marginTop: spacing.xxs },
  logoutButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  logoutHover: {
    backgroundColor: "rgba(183, 71, 58, 0.12)",
  },
  logoutText: { color: "#E7A28F", fontSize: 13, fontWeight: "600" },
  pressed: { opacity: 0.7 },
});
