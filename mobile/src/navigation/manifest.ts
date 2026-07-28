import type { ComponentType } from "react";
import type { Href } from "expo-router";
import {
  Building2,
  CalendarClock,
  Church,
  Ellipsis,
  Guitar,
  Home,
  Music2,
  Shield,
  User as UserIcon,
  UserCircle2,
  Users,
} from "lucide-react-native";
import type { User } from "../types";
import { canManageInstrumentCatalog } from "../utils/instrumentCatalog";
import { canManageMusic } from "../utils/musicPermissions";
import { canAccessChurchAdmin, canAccessGlobalAdminArea, canViewMembers } from "../utils/permissions";
import { ROUTES, type RouteKey } from "./routes";

export type NavigationIconProps = {
  color?: string;
  size?: number;
  strokeWidth?: number;
};

export type NavigationPlacement = "mobile-tab" | "desktop-sidebar" | "mobile-more";
export type SidebarGroup = "Visão geral" | "Operação" | "Pessoas" | "Configurações";
export type NavigationSubject = Pick<User, "role" | "permissions"> | null | undefined;

export type NavigationItem = {
  id: string;
  route: RouteKey;
  label: string;
  description?: string;
  Icon: ComponentType<NavigationIconProps>;
  placements: readonly NavigationPlacement[];
  sidebarGroup?: SidebarGroup;
  href?: Href;
  canAccess: (user: NavigationSubject) => boolean;
};

const always = () => true;

export const NAVIGATION_ITEMS = [
  { id: "home", route: "home", label: "Início", Icon: Home, placements: ["mobile-tab", "desktop-sidebar"], sidebarGroup: "Visão geral", canAccess: always },
  { id: "schedules", route: "schedules", label: "Escalas", Icon: CalendarClock, placements: ["mobile-tab", "desktop-sidebar"], sidebarGroup: "Operação", canAccess: always },
  { id: "ministries", route: "ministries", label: "Ministérios", Icon: Church, placements: ["mobile-tab", "desktop-sidebar"], sidebarGroup: "Operação", canAccess: always },
  { id: "songs", route: "songs", label: "Músicas", Icon: Music2, placements: ["mobile-tab", "desktop-sidebar"], sidebarGroup: "Operação", canAccess: always },
  { id: "profile-more", route: "profile", label: "Perfil", description: "Foto, dados pessoais e instrumentos do seu perfil.", Icon: UserCircle2, placements: ["mobile-more"], canAccess: always },
  { id: "members", route: "members", label: "Membros", description: "Consulte pessoas, convites, permissões e vínculos ministeriais.", Icon: Users, placements: ["desktop-sidebar", "mobile-more"], sidebarGroup: "Pessoas", canAccess: canViewMembers },
  { id: "artists", route: "artists", label: "Artistas", description: "Edite o catálogo de artistas usado em músicas e cifras.", Icon: Music2, placements: ["mobile-more"], canAccess: (user) => canManageMusic(user, "song:edit") || canManageMusic(user, "song:create") },
  { id: "instruments", route: "instruments", label: "Instrumentos/Cargos", description: "Cadastre e ajuste funções usadas em membros e escalas.", Icon: Guitar, placements: ["mobile-more"], href: { pathname: ROUTES.instruments.path, params: { returnTo: ROUTES.profile.path } }, canAccess: canManageInstrumentCatalog },
  { id: "church-more", route: "church", label: "Dados da Igreja", description: "Acompanhe indicadores do tenant e abra as gestões administrativas.", Icon: Building2, placements: ["mobile-more"], canAccess: canAccessChurchAdmin },
  { id: "global-admin", route: "globalAdmin", label: "Painel Global", description: "CRUD global, permissões e operação multi-igreja.", Icon: Shield, placements: ["mobile-more"], canAccess: canAccessGlobalAdminArea },
  { id: "church-sidebar", route: "church", label: "Igreja", Icon: Church, placements: ["desktop-sidebar"], sidebarGroup: "Configurações", canAccess: canAccessChurchAdmin },
  { id: "profile-sidebar", route: "profile", label: "Perfil", Icon: UserIcon, placements: ["desktop-sidebar"], sidebarGroup: "Configurações", canAccess: always },
  { id: "more", route: "more", label: "Mais", Icon: Ellipsis, placements: ["mobile-tab"], canAccess: always },
] as const satisfies readonly NavigationItem[];

export const SIDEBAR_GROUPS: readonly SidebarGroup[] = ["Visão geral", "Operação", "Pessoas", "Configurações"];

export function navigationItemsFor(
  placement: NavigationPlacement,
  user: NavigationSubject
): NavigationItem[] {
  return NAVIGATION_ITEMS.filter(
    (item) => (item.placements as readonly NavigationPlacement[]).includes(placement) && item.canAccess(user)
  );
}

export function hrefForNavigationItem(item: NavigationItem): Href {
  return item.href ?? ROUTES[item.route].path as Href;
}

export function routeMatches(currentRoute: string, routeKey: RouteKey): boolean {
  const prefix = ROUTES[routeKey].path;
  if (prefix === "/") {
    return currentRoute === "/" || currentRoute === "/(tabs)" || currentRoute === "/(tabs)/";
  }
  const staticPrefix = prefix.split("/[", 1)[0];
  return currentRoute === staticPrefix || currentRoute.startsWith(`${staticPrefix}/`);
}
