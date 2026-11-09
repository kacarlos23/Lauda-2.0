import { cleanCatalogText, normalizeCatalogText } from "../utils/catalogNormalization";

export const SONG_TAG_NAME_MAX = 40;
export const SONG_TAGS_MAX = 12;

/** Suggested themes. Churches are not required to use them. */
export const SUGGESTED_SONG_TAGS = [
  "Adoração",
  "Louvor/Celebração",
  "Comunhão/Santa Ceia",
  "Ofertório",
  "Consagração",
  "Missões",
  "Natal",
  "Páscoa",
  "Batismo",
  "Arrependimento",
  "Gratidão",
  "Esperança/Volta de Cristo",
] as const;

export type PreparedSongTag = { name: string; normalizedName: string };

export function prepareSongTags(names: readonly string[]): PreparedSongTag[] {
  const seen = new Set<string>();
  const tags: PreparedSongTag[] = [];
  for (const raw of names) {
    const name = cleanCatalogText(raw);
    if (!name) continue;
    const normalizedName = normalizeCatalogText(name);
    if (seen.has(normalizedName)) continue;
    seen.add(normalizedName);
    tags.push({ name, normalizedName });
  }
  return tags;
}

export function sortSongTagNames(names: readonly string[]): string[] {
  return [...names].sort((left, right) => left.localeCompare(right, "pt-BR"));
}
