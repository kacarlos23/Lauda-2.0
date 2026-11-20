import type { Href } from "expo-router";
import { hrefForNavigationItem, navigationItemsFor, type NavigationSubject } from "../../navigation/manifest";
import type { RouteKey } from "../../navigation/routes";

export const CURRENT_ONBOARDING_VERSION = "v1";

export type OnboardingStep = {
  id: string;
  route: RouteKey;
  title: string;
  description: string;
  kind: "navigation" | "instruments";
  navigationItemId?: string;
  href?: Href;
  sidebarTestId?: string;
};

const STEP_DESCRIPTIONS: Partial<Record<RouteKey, string>> = {
  home: "Veja sua próxima escala e os atalhos disponíveis.",
  schedules: "Consulte as escalas e, quando estiver escalado, confirme ou recuse sua participação.",
  ministries: "Consulte seus ministérios e acompanhe as equipes às quais tem acesso.",
  songs: "Pesquise o repertório e abra as cifras.",
  more: "Acesse seu perfil e os demais atalhos disponíveis para sua conta.",
  members: "Consulte pessoas, convites, permissões e vínculos ministeriais.",
  church: "Acompanhe os dados e indicadores da sua igreja.",
  profile: "Atualize seu perfil e acesse seus instrumentos ou cargos.",
};

function sidebarTestIdForHref(href: string): string {
  return `sidebar-nav-${href === "/" ? "home" : href.replace(/^\//, "").replace(/\//g, "-")}`;
}

export function buildOnboardingSteps(
  user: NavigationSubject,
  options: { isMobile: boolean }
): OnboardingStep[] {
  const placement = options.isMobile ? "mobile-tab" : "desktop-sidebar";
  const items = navigationItemsFor(placement, user);

  const navigationSteps: OnboardingStep[] = items.map((item) => {
    const href = hrefForNavigationItem(item);
    return {
      id: `step-${item.id}`,
      route: item.route,
      title: item.label,
      description: STEP_DESCRIPTIONS[item.route] ?? item.description ?? "Explore os recursos disponíveis nesta seção.",
      kind: "navigation",
      navigationItemId: item.id,
      href,
      sidebarTestId: options.isMobile ? undefined : sidebarTestIdForHref(String(href)),
    };
  });

  navigationSteps.push({
    id: "step-instruments",
    route: "profile",
    title: "Vincule seu instrumento ou cargo",
    description: "Para ser escalado em uma função, vincule ao seu perfil o instrumento ou cargo correspondente.",
    kind: "instruments",
  });

  return navigationSteps;
}
