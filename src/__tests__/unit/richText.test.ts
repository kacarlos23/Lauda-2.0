import { countRichTextCharacters, richTextToPlainText } from "../../contracts/richText";
import { sanitizeRichText } from "../../security/richText";
import { richTextCommentsSchema } from "../../validators/richText.schema";

describe("rich text comments", () => {
  it("preserves only supported formatting", () => {
    const result = sanitizeRichText(
      '<div><b>Importante</b> <i>hoje</i> <u>às 19h</u><ul><li><span style="color:#157A6E">Chegar cedo</span></li></ul></div>'
    );

    expect(result).toContain("<p><strong>Importante</strong> <em>hoje</em> <u>às 19h</u>");
    expect(result).toContain('<span style="color:#157A6E">Chegar cedo</span>');
    expect(richTextToPlainText(result)).toContain("Importante hoje às 19h");
  });

  it("removes executable or unsupported markup", () => {
    const result = sanitizeRichText(
      '<p onclick="alert(1)">Olá<script>alert(1)</script><img src=x onerror=alert(1)><span style="color:red;background:url(javascript:alert(1))">mundo</span></p>'
    );

    expect(result).toBe("<p>Olá<span>mundo</span></p>");
    expect(result).not.toMatch(/script|onclick|onerror|javascript|background|<img/i);
  });

  it("normalizes empty content to null", () => {
    expect(sanitizeRichText("<p><br></p>")).toBeNull();
    expect(richTextCommentsSchema.parse("")).toBeNull();
  });

  it("counts visible graphemes instead of HTML", () => {
    expect(countRichTextCharacters(`<strong>${"😀".repeat(3_000)}</strong>`)).toBe(3_000);
    expect(() => richTextCommentsSchema.parse(`<strong>${"😀".repeat(3_001)}</strong>`)).toThrow(/3.000/);
  });

  it("rejects markup amplification", () => {
    expect(() => richTextCommentsSchema.parse(`<strong>${"a".repeat(30_001)}</strong>`)).toThrow();
  });
});
