import sanitizeHtml from "sanitize-html";
import {
  countRichTextCharacters,
  RICH_TEXT_MAX_CHARACTERS,
  RICH_TEXT_MAX_HTML_LENGTH,
  richTextToPlainText,
} from "../contracts/richText";

const SAFE_COLOR = /^#[0-9a-f]{6}$/i;

export function sanitizeRichText(value: string): string | null {
  if (value.length > RICH_TEXT_MAX_HTML_LENGTH) {
    throw new Error(`O conteúdo formatado deve ter no máximo ${RICH_TEXT_MAX_HTML_LENGTH} caracteres.`);
  }

  const sanitized = sanitizeHtml(value, {
    allowedTags: ["p", "br", "strong", "em", "u", "span", "ul", "ol", "li"],
    allowedAttributes: { span: ["style"] },
    allowedStyles: { span: { color: [SAFE_COLOR] } },
    disallowedTagsMode: "discard",
    parseStyleAttributes: true,
    transformTags: {
      b: "strong",
      i: "em",
      div: "p",
      font: (_tagName, attribs) => {
        const safeAttributes: Record<string, string> = {};
        if (SAFE_COLOR.test(attribs.color ?? "")) safeAttributes.style = `color:${attribs.color}`;
        return { tagName: "span", attribs: safeAttributes };
      },
    },
  }).trim();

  if (!richTextToPlainText(sanitized)) return null;
  if (countRichTextCharacters(sanitized) > RICH_TEXT_MAX_CHARACTERS) {
    throw new Error("Os comentários devem ter no máximo 3.000 caracteres.");
  }
  return sanitized;
}
