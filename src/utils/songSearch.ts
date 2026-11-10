import { normalizeCatalogText } from "./catalogNormalization";

export function parseSongSearch(value: string) {
  const normalized = normalizeCatalogText(value);
  const themeOnly = normalized.startsWith("#");
  const term = themeOnly ? normalized.slice(1).trim() : normalized;
  return { term, themeOnly, themeTerm: foldThemeSearch(term) };
}

export function foldThemeSearch(value: string): string {
  return normalizeCatalogText(value).normalize("NFD").replace(/\p{M}/gu, "");
}
