import fs from "node:fs";
import path from "node:path";

jest.mock("lucide-react-native", () => {
  const Icon = () => null;
  return {
    Building2: Icon,
    CalendarClock: Icon,
    Church: Icon,
    Ellipsis: Icon,
    Guitar: Icon,
    Home: Icon,
    Music2: Icon,
    Shield: Icon,
    User: Icon,
    UserCircle2: Icon,
    Users: Icon,
  };
});

import { rolePermissionMap } from "../utils/permissions";
import type { Role } from "../types";
import {
  materializeRoutePath,
  nav,
  normalizePathname,
  routeForPathname,
  ROUTES,
  titleForPathname,
  type RouteKey,
} from "./routes";
import { activeMobileTabIndex, navigationItemsFor } from "./manifest";

const SAMPLE_ID = "123e4567-e89b-12d3-a456-426614174000";
const routeEntries = Object.entries(ROUTES) as Array<[RouteKey, (typeof ROUTES)[RouteKey]]>;

describe("catálogo de rotas", () => {
  it("mantém as 26 rotas com chaves, paths e telas Expo únicos", () => {
    expect(routeEntries).toHaveLength(26);
    expect(new Set(routeEntries.map(([key, route]) => route.key === key))).toEqual(new Set([true]));
    expect(new Set(routeEntries.map(([, route]) => route.path))).toHaveProperty("size", 26);
    expect(new Set(routeEntries.map(([, route]) => route.expoScreen))).toHaveProperty("size", 26);
  });

  it("resolve rotas estáticas antes das dinâmicas e fornece títulos web", () => {
    expect(routeForPathname("/ministries/assign")?.key).toBe("ministryAssign");
    expect(routeForPathname(`/ministries/${SAMPLE_ID}`)?.key).toBe("ministryDetail");
    expect(routeForPathname(`/ministries/${SAMPLE_ID}/members`)?.key).toBe("ministryMembers");
    expect(routeForPathname(`/songs/${SAMPLE_ID}/edit`)?.key).toBe("songEdit");
    expect(titleForPathname(`/songs/${SAMPLE_ID}?returnTo=%2Fsongs`)).toBe("Cifra | Lauda");
    expect(titleForPathname("/rota-inexistente")).toBe("Lauda");
  });

  it("normaliza grupos do Expo, query, hash e barras finais", () => {
    expect(normalizePathname("/(tabs)")).toBe("/");
    expect(normalizePathname("/(tabs)/songs/?page=2")).toBe("/songs");
    expect(normalizePathname("/(auth)/login#form")).toBe("/login");
    expect(normalizePathname("/index")).toBe("/");
  });

  it("constrói IDs e query params sem coerções de tipo", () => {
    expect(nav.scheduleEdit(SAMPLE_ID)).toEqual({
      pathname: "/schedules/[id]/edit",
      params: { id: SAMPLE_ID },
    });
    expect(nav.ministryMembers(SAMPLE_ID)).toEqual({
      pathname: "/ministries/[id]/members",
      params: { id: SAMPLE_ID },
    });
    expect(nav.songEdit(SAMPLE_ID)).toEqual({
      pathname: "/songs/[id]/edit",
      params: { id: SAMPLE_ID },
    });
    expect(nav.ministryAssign("ministry-1")).toEqual({
      pathname: "/ministries/assign",
      params: { ministryId: "ministry-1" },
    });
    expect(nav.instruments("/profile")).toEqual({
      pathname: "/instruments",
      params: { returnTo: "/profile" },
    });
  });

  it("mantém catálogo, arquivos Expo e rewrites dinâmicos sincronizados", () => {
    const expectedFiles = routeEntries.map(([, route]) => {
      if (route.key === "invite") return path.join("app", "convite.tsx");
      const group = "tabScreen" in route && route.tabScreen ? "(tabs)" : "(auth)";
      return path.join("app", group, `${route.expoScreen}.tsx`);
    });

    for (const file of expectedFiles) {
      expect(fs.existsSync(path.resolve(file))).toBe(true);
    }

    const serveConfig = JSON.parse(fs.readFileSync(path.resolve("serve.json"), "utf8")) as {
      rewrites: Array<{ destination: string }>;
    };
    const expectedDynamicDestinations = routeEntries
      .filter(([, route]) => route.path.includes("[id]"))
      .map(([, route]) => `/${route.expoScreen}.html`)
      .sort();
    expect(serveConfig.rewrites.map((rewrite) => rewrite.destination).sort()).toEqual(expectedDynamicDestinations);

    for (const [key, route] of routeEntries) {
      expect(routeForPathname(materializeRoutePath(key, SAMPLE_ID))?.key).toBe(key);
    }
  });
});

describe("manifesto de navegação por papel", () => {
  const subjects = Object.fromEntries(
    (["GLOBAL_ADMIN", "TENANT_ADMIN", "MINISTRY_LEADER", "MEMBER"] as Role[]).map((role) => [
      role,
      { role, permissions: rolePermissionMap[role] },
    ])
  ) as Record<Role, { role: Role; permissions: (typeof rolePermissionMap)[Role] }>;

  it.each([
    ["GLOBAL_ADMIN", ["home", "schedules", "ministries", "songs", "members", "church", "profile"]],
    ["TENANT_ADMIN", ["home", "schedules", "ministries", "songs", "members", "church", "profile"]],
    ["MINISTRY_LEADER", ["home", "schedules", "ministries", "songs", "profile"]],
    ["MEMBER", ["home", "schedules", "ministries", "songs", "profile"]],
  ] as const)("preserva a sidebar de %s", (role, expectedRoutes) => {
    expect(navigationItemsFor("desktop-sidebar", subjects[role]).map((item) => item.route)).toEqual(expectedRoutes);
  });

  it.each([
    ["GLOBAL_ADMIN", ["profile", "members", "artists", "instruments", "church", "globalAdmin"]],
    ["TENANT_ADMIN", ["profile", "members", "artists", "instruments", "church"]],
    ["MINISTRY_LEADER", ["profile", "artists"]],
    ["MEMBER", ["profile"]],
  ] as const)("preserva os atalhos Mais de %s", (role, expectedRoutes) => {
    expect(navigationItemsFor("mobile-more", subjects[role]).map((item) => item.route)).toEqual(expectedRoutes);
  });

  it("mantém a seleção mobile nas rotas internas e nos atalhos de Mais", () => {
    const user = subjects.TENANT_ADMIN;
    const tabs = navigationItemsFor("mobile-tab", user);
    const moreItems = navigationItemsFor("mobile-more", user);
    const selectedId = (pathname: string) => tabs[
      activeMobileTabIndex(pathname, tabs, moreItems)
    ]?.id;

    expect(selectedId("/songs/song-1")).toBe("songs");
    expect(selectedId("/schedules/schedule-1/edit")).toBe("schedules");
    expect(selectedId("/ministries/ministry-1/members")).toBe("ministries");
    expect(selectedId("/profile")).toBe("more");
    expect(selectedId("/members/new")).toBe("more");
    expect(selectedId("/rota-inexistente")).toBeUndefined();
  });
});
