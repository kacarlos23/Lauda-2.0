export const RICH_TEXT_MAX_CHARACTERS = 3_000;
export const RICH_TEXT_MAX_HTML_LENGTH = 30_000;

const BLOCK_OR_BREAK_TAGS = new Set(["br", "br/", "/div", "/p", "/li", "/ul", "/ol"]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

function stripMarkupToPlainText(value: string): string {
  let result = "";
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "<") {
      const close = value.indexOf(">", i + 1);
      if (close !== -1) {
        const tag = value.slice(i + 1, close).trim().toLowerCase();
        if (BLOCK_OR_BREAK_TAGS.has(tag) || tag.startsWith("br ") || tag.startsWith("br/")) {
          result += "\n";
        }
        i = close;
        continue;
      }
    }
    result += value[i];
  }
  return result;
}

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
  return decodeRichTextEntities(stripMarkupToPlainText(value))
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
