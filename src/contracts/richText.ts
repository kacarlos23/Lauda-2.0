export const RICH_TEXT_MAX_CHARACTERS = 3_000;
export const RICH_TEXT_MAX_HTML_LENGTH = 30_000;

const BLOCK_END = /<\/(?:div|p|li|ul|ol)>/gi;
const LINE_BREAK = /<br\s*\/?>/gi;
const TAG = /<[^>]*>/g;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

export function decodeRichTextEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, token: string) => {
    if (token.startsWith("#x") || token.startsWith("#X")) {
      const codePoint = Number.parseInt(token.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    if (token.startsWith("#")) {
      const codePoint = Number.parseInt(token.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    return NAMED_ENTITIES[token.toLowerCase()] ?? entity;
  });
}

export function richTextToPlainText(value?: string | null): string {
  if (!value) return "";
  return decodeRichTextEntities(
    value
      .replace(LINE_BREAK, "\n")
      .replace(BLOCK_END, "\n")
      .replace(TAG, "")
  )
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function countRichTextCharacters(value?: string | null): number {
  const plainText = richTextToPlainText(value);
  if (!plainText) return 0;
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const Segmenter = Intl.Segmenter;
    return Array.from(new Segmenter("pt-BR", { granularity: "grapheme" }).segment(plainText)).length;
  }
  return Array.from(plainText).length;
}
