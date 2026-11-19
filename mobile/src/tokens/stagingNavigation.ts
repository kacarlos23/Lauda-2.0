import { colors } from "../theme";

export const stagingNavigationEnabled = process.env.EXPO_PUBLIC_APP_ENV === "staging";
export const desktopIndicatorEasing = [0.22, 1, 0.36, 1] as const;
const navigationEase = `cubic-bezier(${desktopIndicatorEasing.join(", ")})`;

export const stagingNavigationCss = `
  div[data-testid="staging-dock-surface"] {
    background-color: rgba(248, 250, 246, 0.72);
    backdrop-filter: blur(12px) saturate(1.18);
    -webkit-backdrop-filter: blur(12px) saturate(1.18);
    border: 1px solid rgba(16, 40, 32, 0.10);
    border-radius: 26px;
    box-shadow: 0 12px 30px rgba(16, 40, 32, 0.14);
    transition: all 250ms ${navigationEase};
  }
  [data-color-mode="dark"] [data-testid="staging-dock-surface"] {
    background-color: rgba(25, 33, 28, 0.72);
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.32);
  }
  [data-testid^="staging-dock-tab-"] {
    transition: background-color 170ms ${navigationEase}, transform 170ms ${navigationEase};
  }
  [data-testid^="staging-dock-tab-"][aria-selected="true"] {
    transform: translateY(-1px) scale(1.03);
  }
  [data-testid="staging-indicator-sidebar"] [data-testid^="sidebar-nav-"] {
    transition: background-color 160ms ${navigationEase}, color 160ms ${navigationEase};
  }
  [data-testid="staging-indicator-sidebar-toggle"] {
    transition: background-color 160ms ${navigationEase};
  }
  [data-testid="staging-indicator-sidebar-toggle"]:hover {
    background-color: ${colors.primarySoft};
  }
  @media (prefers-reduced-motion: reduce) {
    [data-testid="staging-dock-surface"],
    [data-testid^="staging-dock-tab-"],
    [data-testid="staging-indicator-sidebar"],
    [data-testid="staging-indicator-sidebar"] * {
      transition-duration: 1ms !important;
      animation-duration: 1ms !important;
    }
  }
`;
