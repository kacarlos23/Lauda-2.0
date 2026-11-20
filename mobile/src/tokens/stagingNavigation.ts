import { colors } from "../theme";

export const stagingNavigationEnabled = true;
export const desktopIndicatorEasing = [0.22, 1, 0.36, 1] as const;
export const stagingTransitionMs = {
  dockIndicator: 165,
  dockButton: 145,
  dockPress: 100,
  sidebarIndicator: 165,
  sidebarItem: 145,
  sidebarWidth: 175,
  scene: 160,
} as const;
const navigationEase = `cubic-bezier(${desktopIndicatorEasing.join(", ")})`;

export const stagingNavigationCss = `
  div[data-testid="staging-dock-surface"] {
    background-color: rgba(248, 250, 246, 0.72);
    backdrop-filter: blur(12px) saturate(1.18);
    -webkit-backdrop-filter: blur(12px) saturate(1.18);
    border: 1px solid rgba(16, 40, 32, 0.10);
    border-radius: 26px;
    box-shadow: 0 12px 30px rgba(16, 40, 32, 0.14);
    overflow: hidden;
    transition: all 250ms ${navigationEase};
  }
  [data-color-mode="dark"] [data-testid="staging-dock-surface"] {
    background-color: rgba(25, 33, 28, 0.72);
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.32);
  }
  [data-testid^="staging-dock-tab-"] {
    transition: transform ${stagingTransitionMs.dockButton}ms ${navigationEase}, opacity ${stagingTransitionMs.dockPress}ms ${navigationEase}, background-color ${stagingTransitionMs.dockButton}ms ${navigationEase};
  }
  [data-testid^="staging-dock-tab-"] svg,
  [data-testid^="staging-dock-tab-"] svg * {
    transition: stroke ${stagingTransitionMs.dockButton}ms ${navigationEase}, color ${stagingTransitionMs.dockButton}ms ${navigationEase};
  }
  [data-testid^="staging-dock-tab-"] div,
  [data-testid^="staging-dock-tab-"] span {
    transition: color ${stagingTransitionMs.dockButton}ms ${navigationEase}, opacity ${stagingTransitionMs.dockButton}ms ${navigationEase};
  }
  [data-testid^="staging-dock-tab-"][aria-selected="true"] {
    transform: translateY(-1px) scale(1.02);
  }
  [data-testid^="staging-dock-tab-"]:active {
    transform: scale(0.96);
    opacity: 0.82;
    transition-duration: ${stagingTransitionMs.dockPress}ms;
  }
  @media (hover: hover) and (pointer: fine) {
    [data-testid^="staging-dock-tab-"]:not([aria-selected="true"]):hover {
      background-color: rgba(31, 111, 85, 0.06);
    }
    [data-color-mode="dark"] [data-testid^="staging-dock-tab-"]:not([aria-selected="true"]):hover {
      background-color: rgba(130, 201, 164, 0.08);
    }
  }
  div[data-testid="staging-indicator-sidebar"] {
    transition: width ${stagingTransitionMs.sidebarWidth}ms ${navigationEase};
  }
  div[data-testid="staging-desktop-content"] {
    transition: margin-left ${stagingTransitionMs.sidebarWidth}ms ${navigationEase};
  }
  div[data-testid="staging-indicator-sidebar"] [data-testid^="sidebar-nav-"][role="link"] {
    transition: background-color ${stagingTransitionMs.sidebarItem}ms ${navigationEase}, opacity ${stagingTransitionMs.dockPress}ms ${navigationEase}, transform ${stagingTransitionMs.dockPress}ms ${navigationEase};
  }
  div[data-testid="staging-indicator-sidebar"] [data-testid^="sidebar-nav-"][role="link"]:hover {
    filter: none;
  }
  div[data-testid="staging-indicator-sidebar"] [data-testid^="sidebar-nav-"][role="link"]:active {
    transform: scale(0.985);
  }
  div[data-testid="staging-indicator-sidebar"] [data-testid^="sidebar-nav-"] div,
  div[data-testid="staging-indicator-sidebar"] [data-testid^="sidebar-nav-"] span {
    transition: color ${stagingTransitionMs.sidebarItem}ms ${navigationEase};
  }
  div[data-testid="staging-indicator-sidebar"] [data-testid^="sidebar-nav-"] svg,
  div[data-testid="staging-indicator-sidebar"] [data-testid^="sidebar-nav-"] svg * {
    transition: stroke ${stagingTransitionMs.sidebarItem}ms ${navigationEase}, color ${stagingTransitionMs.sidebarItem}ms ${navigationEase};
  }
  div[data-testid="staging-indicator-sidebar"] [data-testid="staging-indicator-sidebar-toggle"][role="button"] {
    transition: background-color ${stagingTransitionMs.sidebarItem}ms ${navigationEase}, transform ${stagingTransitionMs.dockPress}ms ${navigationEase};
  }
  div[data-testid="staging-indicator-sidebar"] [data-testid="staging-indicator-sidebar-toggle"][role="button"]:hover {
    background-color: ${colors.primarySoft};
    filter: none;
  }
  div[data-testid="staging-indicator-sidebar"] [data-testid="staging-indicator-sidebar-toggle"][role="button"]:active {
    transform: scale(0.95);
  }
  @media (prefers-reduced-motion: reduce) {
    [data-testid="staging-dock-surface"],
    [data-testid="staging-dock-surface"] *,
    [data-testid^="staging-dock-tab-"],
    [data-testid^="staging-dock-tab-"] *,
    [data-testid="staging-indicator-sidebar"],
    [data-testid="staging-indicator-sidebar"] *,
    [data-testid="staging-desktop-content"] {
      transition-duration: 1ms !important;
      animation-duration: 1ms !important;
    }
    [data-testid^="staging-dock-tab-"][aria-selected="true"],
    [data-testid^="staging-dock-tab-"]:active,
    div[data-testid="staging-indicator-sidebar"] [data-testid^="sidebar-nav-"][role="link"]:active,
    div[data-testid="staging-indicator-sidebar"] [data-testid="staging-indicator-sidebar-toggle"][role="button"]:active {
      transform: none !important;
    }
  }
`;
