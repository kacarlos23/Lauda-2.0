import type { Href } from "expo-router";

export type RouteDefinition = {
  key: string;
  path: string;
  expoScreen: string;
  title: string;
  documentTitle: string;
  match: RegExp;
  tabScreen?: true;
  hideHeaderBack?: true;
};

type RouteConfig = Omit<RouteDefinition, "key">;

function defineRoutes<const T extends Record<string, RouteConfig>>(configs: T) {
  return Object.fromEntries(
    Object.entries(configs).map(([key, config]) => [key, { key, ...config }])
  ) as { readonly [K in keyof T]: Readonly<T[K] & { key: K }> };
}

export const ROUTES = defineRoutes({
  login: { path: "/login", expoScreen: "login", title: "Entrar", documentTitle: "Entrar | Lauda", match: /^\/login$/ },
  register: { path: "/register", expoScreen: "register", title: "Criar igreja", documentTitle: "Criar igreja | Lauda", match: /^\/register$/ },
  memberRegister: { path: "/member-register", expoScreen: "member-register", title: "Entrar por convite", documentTitle: "Entrar por convite | Lauda", match: /^\/member-register$/ },
  invite: { path: "/convite", expoScreen: "convite", title: "Entrar por convite", documentTitle: "Entrar por convite | Lauda", match: /^\/convite$/ },
  forgotPassword: { path: "/forgot-password", expoScreen: "forgot-password", title: "Recuperar senha", documentTitle: "Recuperar senha | Lauda", match: /^\/forgot-password$/ },
  resetPassword: { path: "/reset-password", expoScreen: "reset-password", title: "Redefinir senha", documentTitle: "Redefinir senha | Lauda", match: /^\/reset-password$/ },
  home: { path: "/", expoScreen: "index", title: "Início", documentTitle: "Visão geral | Lauda", match: /^\/$/, tabScreen: true },
  schedules: { path: "/schedules", expoScreen: "schedules/index", title: "Escalas", documentTitle: "Escalas | Lauda", match: /^\/schedules$/, tabScreen: true },
  scheduleNew: { path: "/schedules/new", expoScreen: "schedules/new", title: "Nova Escala", documentTitle: "Nova escala | Lauda", match: /^\/schedules\/new$/, tabScreen: true, hideHeaderBack: true },
  scheduleEdit: { path: "/schedules/[id]/edit", expoScreen: "schedules/[id]/edit", title: "Editar Escala", documentTitle: "Editar escala | Lauda", match: /^\/schedules\/[^/]+\/edit$/, tabScreen: true, hideHeaderBack: true },
  ministries: { path: "/ministries", expoScreen: "ministries/index", title: "Ministérios", documentTitle: "Ministérios | Lauda", match: /^\/ministries$/, tabScreen: true },
  ministryDetail: { path: "/ministries/[id]", expoScreen: "ministries/[id]", title: "Ministério", documentTitle: "Ministério | Lauda", match: /^\/ministries\/[^/]+$/, tabScreen: true, hideHeaderBack: true },
  ministryMembers: { path: "/ministries/[id]/members", expoScreen: "ministries/[id]/members", title: "Membros do ministério", documentTitle: "Membros do ministério | Lauda", match: /^\/ministries\/[^/]+\/members$/, tabScreen: true, hideHeaderBack: true },
  ministryAssign: { path: "/ministries/assign", expoScreen: "ministries/assign", title: "Atribuir membro", documentTitle: "Atribuir membro | Lauda", match: /^\/ministries\/assign$/, tabScreen: true, hideHeaderBack: true },
  songs: { path: "/songs", expoScreen: "songs/index", title: "Músicas", documentTitle: "Músicas | Lauda", match: /^\/songs$/, tabScreen: true },
  songNew: { path: "/songs/new", expoScreen: "songs/new", title: "Nova música", documentTitle: "Nova música | Lauda", match: /^\/songs\/new$/, tabScreen: true, hideHeaderBack: true },
  songDetail: { path: "/songs/[id]", expoScreen: "songs/[id]", title: "Cifra", documentTitle: "Cifra | Lauda", match: /^\/songs\/[^/]+$/, tabScreen: true, hideHeaderBack: true },
  songEdit: { path: "/songs/[id]/edit", expoScreen: "songs/[id]/edit", title: "Editar música", documentTitle: "Editar música | Lauda", match: /^\/songs\/[^/]+\/edit$/, tabScreen: true, hideHeaderBack: true },
  artists: { path: "/artists", expoScreen: "artists/index", title: "Artistas", documentTitle: "Artistas | Lauda", match: /^\/artists$/, tabScreen: true, hideHeaderBack: true },
  more: { path: "/more", expoScreen: "more", title: "Mais", documentTitle: "Mais | Lauda", match: /^\/more$/, tabScreen: true },
  members: { path: "/members", expoScreen: "members/index", title: "Membros", documentTitle: "Membros | Lauda", match: /^\/members$/, tabScreen: true },
  memberNew: { path: "/members/new", expoScreen: "members/new", title: "Novo membro", documentTitle: "Novo membro | Lauda", match: /^\/members\/new$/, tabScreen: true, hideHeaderBack: true },
  globalAdmin: { path: "/global-admin", expoScreen: "global-admin/index", title: "Admin Global", documentTitle: "Admin global | Lauda", match: /^\/global-admin$/, tabScreen: true },
  church: { path: "/church", expoScreen: "church/index", title: "Dados da Igreja", documentTitle: "Igreja | Lauda", match: /^\/church$/, tabScreen: true },
  instruments: { path: "/instruments", expoScreen: "instruments/index", title: "Instrumentos/Cargos", documentTitle: "Instrumentos e cargos | Lauda", match: /^\/instruments$/, tabScreen: true, hideHeaderBack: true },
  profile: { path: "/profile", expoScreen: "profile", title: "Perfil", documentTitle: "Perfil | Lauda", match: /^\/profile$/, tabScreen: true },
} as const satisfies Record<string, RouteConfig>);

export type RouteKey = keyof typeof ROUTES;
export type StaticRouteKey = Exclude<RouteKey, "scheduleEdit" | "ministryDetail" | "ministryMembers" | "songDetail" | "songEdit">;
export type InstrumentReturnTo = typeof ROUTES.profile.path | typeof ROUTES.church.path;

export const GROUP_HREFS = {
  auth: "/(auth)/login",
  tabs: "/(tabs)",
} as const satisfies Record<string, Href>;

export const nav = {
  login: ROUTES.login.path,
  register: ROUTES.register.path,
  memberRegister: ROUTES.memberRegister.path,
  invite: ROUTES.invite.path,
  forgotPassword: ROUTES.forgotPassword.path,
  resetPassword: ROUTES.resetPassword.path,
  home: ROUTES.home.path,
  schedules: ROUTES.schedules.path,
  scheduleNew: ROUTES.scheduleNew.path,
  scheduleEdit: (id: string): Href => ({ pathname: ROUTES.scheduleEdit.path, params: { id } }),
  ministries: ROUTES.ministries.path,
  ministryDetail: (id: string): Href => ({ pathname: ROUTES.ministryDetail.path, params: { id } }),
  ministryMembers: (id: string): Href => ({ pathname: ROUTES.ministryMembers.path, params: { id } }),
  ministryAssign: (ministryId?: string): Href => ministryId
    ? { pathname: ROUTES.ministryAssign.path, params: { ministryId } }
    : ROUTES.ministryAssign.path,
  songs: ROUTES.songs.path,
  songNew: ROUTES.songNew.path,
  songDetail: (id: string): Href => ({ pathname: ROUTES.songDetail.path, params: { id } }),
  songEdit: (id: string): Href => ({ pathname: ROUTES.songEdit.path, params: { id } }),
  artists: ROUTES.artists.path,
  more: ROUTES.more.path,
  members: ROUTES.members.path,
  memberNew: ROUTES.memberNew.path,
  globalAdmin: ROUTES.globalAdmin.path,
  church: ROUTES.church.path,
  instruments: (returnTo?: InstrumentReturnTo): Href => returnTo
    ? { pathname: ROUTES.instruments.path, params: { returnTo } }
    : ROUTES.instruments.path,
  profile: ROUTES.profile.path,
} as const;

export const TAB_ROUTE_KEYS = (Object.keys(ROUTES) as RouteKey[]).filter(
  (key) => (ROUTES[key] as RouteDefinition).tabScreen
);

export function normalizePathname(pathname: string): string {
  const withoutGroup = pathname.replace(/^\/\((auth|tabs)\)/, "");
  const withoutQuery = withoutGroup.split(/[?#]/, 1)[0];
  if (!withoutQuery || withoutQuery === "/index") return "/";
  return withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, "") : withoutQuery;
}

export function routeForPathname(pathname: string): (typeof ROUTES)[RouteKey] | undefined {
  const normalized = normalizePathname(pathname);
  const definitions = (Object.keys(ROUTES) as RouteKey[]).map((key) => ROUTES[key]);
  const staticRoute = definitions.find((route) => !route.path.includes("[") && route.path === normalized);
  if (staticRoute) return staticRoute;
  return definitions
    .filter((route) => route.path.includes("["))
    .sort((left, right) => right.path.length - left.path.length)
    .find((route) => route.match.test(normalized));
}

export function titleForPathname(pathname: string): string {
  return routeForPathname(pathname)?.documentTitle ?? "Lauda";
}

export function materializeRoutePath(key: RouteKey, sampleId: string): string {
  return ROUTES[key].path.replace("[id]", sampleId);
}
