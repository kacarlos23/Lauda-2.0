import { create } from "zustand";
import { lightColors, lightOverlays } from "../theme";
import { ColorMode, ThemePreference, THEME_STORAGE_KEY, darkColors, darkOverlays, isThemePreference, resolveColorMode, themeVariable } from "../tokens/colorModes";

export function applyWebTheme(preference: ThemePreference, systemDark: boolean): ColorMode {
  const mode = resolveColorMode(preference, systemDark);
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    for (const [group, values] of Object.entries({ color: mode === "dark" ? { ...lightColors, ...darkColors } : lightColors, overlay: mode === "dark" ? { ...lightOverlays, ...darkOverlays } : lightOverlays })) {
      for (const [key, value] of Object.entries(values)) root.style.setProperty(themeVariable(group, key), value);
    }
    root.dataset.colorMode = mode;
    root.style.colorScheme = mode;
  }
  return mode;
}

type ThemeState = {
  preference: ThemePreference;
  mode: ColorMode;
  setPreference: (preference: ThemePreference) => void;
  initialize: () => () => void;
};

export const useThemeStore = create<ThemeState>((set) => ({
  preference: "system", mode: "light",
  setPreference: (preference) => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(THEME_STORAGE_KEY, preference); } catch { /* A blocked storage must not disable theme switching. */ }
    const url = new URL(window.location.href);
    if (url.searchParams.has("theme")) {
      url.searchParams.set("theme", preference);
      window.history.replaceState(window.history.state, "", url);
    }
    const mode = applyWebTheme(preference, window.matchMedia("(prefers-color-scheme: dark)").matches);
    set({ preference, mode });
  },
  initialize: () => {
    if (typeof window === "undefined") return () => {};
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const requested = new URL(window.location.href).searchParams.get("theme");
    let saved: string | null = null;
    try { saved = window.localStorage.getItem(THEME_STORAGE_KEY); } catch { /* Use the system preference when storage is unavailable. */ }
    const preference = isThemePreference(requested) ? requested : isThemePreference(saved) ? saved : "system";
    const mode = applyWebTheme(preference, media.matches);
    set({ preference, mode });
    if (isThemePreference(requested)) {
      try { window.localStorage.setItem(THEME_STORAGE_KEY, requested); } catch { /* Theme is still applied. */ }
    }
    const onSystemChange = () => {
      const current = useThemeStore.getState().preference;
      if (current === "system") set({ mode: applyWebTheme(current, media.matches) });
    };
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  },
}));

// Runs in the document head before the first paint, using the same color roles as React.
export function themeBootstrapScript(): string {
  const palettes = {
    light: { color: lightColors, overlay: lightOverlays },
    dark: { color: { ...lightColors, ...darkColors }, overlay: { ...lightOverlays, ...darkOverlays } },
  };
  return `(function(){try{var q=new URL(location.href).searchParams.get('theme'),s=null;try{s=localStorage.getItem('${THEME_STORAGE_KEY}');}catch(e){}var a=['light','dark','system'],p=a.indexOf(q)>=0?q:a.indexOf(s)>=0?s:'system';var m=p==='dark'||p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';var d=${JSON.stringify(palettes)}[m];for(var g in d)for(var k in d[g])document.documentElement.style.setProperty('--lauda-'+g+'-'+k,d[g][k]);document.documentElement.dataset.colorMode=m;document.documentElement.style.colorScheme=m;}catch(e){}})();`;
}
