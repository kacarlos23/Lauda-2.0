import type { EdgeInsets, useSafeAreaInsets as UseSafeAreaInsetsHook } from "react-native-safe-area-context";

const ZERO_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

let cachedHook: typeof UseSafeAreaInsetsHook | null | undefined;

function resolveUseSafeAreaInsets(): typeof UseSafeAreaInsetsHook | null {
  if (cachedHook !== undefined) return cachedHook;
  try {
    const mod = require("react-native-safe-area-context") as {
      useSafeAreaInsets?: typeof UseSafeAreaInsetsHook;
    };
    cachedHook = typeof mod?.useSafeAreaInsets === "function" ? mod.useSafeAreaInsets : null;
  } catch {
    cachedHook = null;
  }
  return cachedHook;
}

export function useSafeInsets(): EdgeInsets {
  const hook = resolveUseSafeAreaInsets();
  if (!hook) {
    return ZERO_INSETS;
  }
  try {
    return hook();
  } catch {
    return ZERO_INSETS;
  }
}
