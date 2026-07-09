import React, { ComponentType, memo, useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
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
import { colors, shadow, spacing } from "../theme";
import { useAuthStore } from "../store/authStore";
import { canAccessChurchAdmin, canViewMembers, formatRoleLabel } from "../utils/permissions";

export const SIDEBAR_COLLAPSED_WIDTH = 72;
export const SIDEBAR_EXPANDED_WIDTH = 240;
export const SIDEBAR_ANIMATION_MS = 250;

type IconProps = {
  color?: string;
  size?: number;
  strokeWidth?: number;
};

type SidebarItem = {
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

function SidebarNavigationComponent({ isCollapsed, onToggle, currentRoute }: SidebarNavigationProps) {
  const { user, logout } = useAuthStore();
  const labelOpacity = useRef(new Animated.Value(isCollapsed ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(labelOpacity, {
      toValue: isCollapsed ? 0 : 1,
      duration: SIDEBAR_ANIMATION_MS,
      useNativeDriver: true,
    }).start();
  }, [isCollapsed, labelOpacity]);

  const items: SidebarItem[] = [
    { label: "Início", href: "/", routePrefix: "/", Icon: Home },
    { label: "Escalas", href: "/schedules", routePrefix: "/schedules", Icon: CalendarClock },
    { label: "Ministérios", href: "/ministries", routePrefix: "/ministries", Icon: Church },
    { label: "Músicas", href: "/songs", routePrefix: "/songs", Icon: Music2 },
    { label: "Membros", href: "/members", routePrefix: "/members", Icon: Users, visible: canViewMembers(user?.role) },
    { label: "Igreja", href: "/church", routePrefix: "/church", Icon: Church, visible: canAccessChurchAdmin(user?.role) },
    { label: "Perfil", href: "/profile", routePrefix: "/profile", Icon: User },
  ];

  const visibleItems = items.filter((item) => item.visible !== false);
  const width = isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  return (
    <View style={[styles.sidebar, { width }]} accessibilityLabel="Menu principal">
      <View style={[styles.header, isCollapsed && styles.centered]}>
        <View style={styles.logoMark}>
          <Text style={styles.logoText}>L</Text>
        </View>
        {!isCollapsed ? (
          <Animated.View style={[styles.logoCopy, { opacity: labelOpacity }]}>
            <Text style={styles.brand}>Lauda</Text>
            <Text style={styles.brandSub}>Ministério</Text>
          </Animated.View>
        ) : null}
        <Pressable
          onPress={onToggle}
          hitSlop={10}
          style={({ pressed }) => [styles.toggleButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={isCollapsed ? "Expandir menu" : "Recolher menu"}
        >
          {isCollapsed ? (
            <ChevronsRight color={colors.ink} size={22} strokeWidth={2.4} />
          ) : (
            <ChevronsLeft color={colors.ink} size={22} strokeWidth={2.4} />
          )}
        </Pressable>
      </View>

      <View style={styles.navList}>
        {visibleItems.map((item) => {
          const active = routeMatches(currentRoute, item.routePrefix);
          const iconColor = active ? colors.primary : colors.ink;
          return (
            <Pressable
              key={item.href}
              onPress={() => router.push(item.href as never)}
              style={(state) => {
                const hovered = Boolean((state as { hovered?: boolean }).hovered);
                return [
                  styles.navItem,
                  isCollapsed && styles.navItemCollapsed,
                  active && styles.navItemActive,
                  hovered && !active && styles.navItemHover,
                  state.pressed && styles.pressed,
                ];
              }}
              accessibilityRole="link"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              testID={navTestId(item.href)}
            >
              <View style={[styles.activeRail, active && styles.activeRailVisible]} />
              <item.Icon color={iconColor} size={24} strokeWidth={2.4} />
              {!isCollapsed ? (
                <Animated.Text style={[styles.navLabel, active && styles.navLabelActive, { opacity: labelOpacity }]}>
                  {item.label}
                </Animated.Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        {!isCollapsed ? (
          <Animated.View style={[styles.userBox, { opacity: labelOpacity }]}>
            <Text style={styles.userName} numberOfLines={1}>{user?.name ?? "Usuário"}</Text>
            <Text style={styles.userRole} numberOfLines={1}>{formatRoleLabel(user?.role)}</Text>
          </Animated.View>
        ) : null}
        <Pressable
          onPress={() => void logout()}
          style={(state) => {
            const hovered = Boolean((state as { hovered?: boolean }).hovered);
            return [
              styles.logoutButton,
              isCollapsed && styles.navItemCollapsed,
              hovered && styles.navItemHover,
              state.pressed && styles.pressed,
            ];
          }}
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
        >
          <LogOut color={colors.danger} size={24} strokeWidth={2.4} />
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
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.line,
    paddingVertical: spacing.lg,
    ...shadow,
  },
  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  centered: {
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  logoText: { color: colors.surface, fontSize: 18, fontWeight: "900" },
  logoCopy: { flex: 1 },
  brand: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  brandSub: { color: colors.muted, fontSize: 11, fontWeight: "800", marginTop: 1 },
  toggleButton: {
    minWidth: 32,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  navList: {
    flex: 1,
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  navItem: {
    minHeight: 48,
    marginHorizontal: spacing.sm,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    position: "relative",
  },
  navItemCollapsed: {
    justifyContent: "center",
    paddingHorizontal: 0,
  },
  navItemActive: {
    backgroundColor: "rgba(21, 122, 110, 0.10)",
  },
  navItemHover: {
    backgroundColor: "rgba(226, 234, 229, 0.50)",
  },
  activeRail: {
    position: "absolute",
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
  },
  activeRailVisible: {
    backgroundColor: colors.primary,
  },
  navLabel: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  navLabelActive: {
    color: colors.primary,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  userBox: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  userName: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  userRole: { color: colors.muted, fontSize: 11, fontWeight: "800", marginTop: 2 },
  logoutButton: {
    minHeight: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  logoutText: { color: colors.danger, fontSize: 14, fontWeight: "900" },
  pressed: { opacity: 0.72 },
});
