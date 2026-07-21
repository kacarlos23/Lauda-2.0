import { z } from "zod";
import { RICH_TEXT_MAX_HTML_LENGTH } from "../contracts/richText";
import { sanitizeRichText } from "../security/richText";

export const richTextCommentsSchema = z.preprocess((value, context) => {
  if (value === undefined || value === null) return value;
  if (typeof value !== "string") return value;
  if (value.length > RICH_TEXT_MAX_HTML_LENGTH) return value;

  try {
    return sanitizeRichText(value);
  } catch (error) {
    context.addIssue({
      code: "custom",
      message: error instanceof Error ? error.message : "Comentários inválidos.",
    });
    return z.NEVER;
  }
}, z.string().max(RICH_TEXT_MAX_HTML_LENGTH).nullable().optional());
