import { hasInlineChords, isChordSymbol, isTraditionalChordLine, mapTraditionalChordLine, normalizeChordText, normalizeSongContent } from "../../utils/chordText";
import { chordContentSchema } from "../../validators/song.schema";

describe("shared chord text", () => {
  it("revisa a resposta sem modificar o registro original e preserva emojis compostos", () => {
    const original = { id: "song", content: "\u200BG\u2060\nUma pessoa 👩‍🎤 canta" };
    expect(normalizeSongContent(original)).toEqual({ id: "song", content: "G\nUma pessoa 👩‍🎤 canta" });
    expect(original.content).toContain("\u200B");
    expect(chordContentSchema.parse("\uFEFFG\u200B\tD\nTexto")).toBe("G       D\nTexto");
    expect(() => chordContentSchema.parse("\u200B\u2060\uFEFF\t")).toThrow("texto visível");
  });
  it("remove caracteres invisíveis sem remover espaços nem linhas do texto", () => {
    expect(normalizeChordText("\uFEFF\u200B    G\u00a0  D\r\n\u200BTexto editado\r\n\r\nFim")).toBe("    G   D\r\nTexto editado\r\n\r\nFim");
  });
  it("expande tabulações nas colunas de um arquivo de texto", () => {
    expect(normalizeChordText("G\tD\n\tAm\tC")).toBe("G       D\n        Am      C");
  });
  it.each(["G", "G7/B", "C7M", "C7M(9)", "Em7(9)", "Dsus4", "F#m7(b5)", "A7(9/13)", "(G)", "Galt", "Comit3", "G♯m", "E♭/B♭"])("reconhece %s como acorde", (value) => {
    expect(isChordSymbol(value)).toBe(true);
  });
  it.each(["Final", "Bridge", "Amigos", "Coro", "Intro", "Primeira Parte"])("não interpreta %s como acorde", (value) => {
    expect(hasInlineChords(`[${value}]`)).toBe(false);
    expect(isChordSymbol(value)).toBe(false);
  });
  it("distingue marcações tradicionais de acordes ChordPro e preserva tablaturas", () => {
    expect(hasInlineChords("[Final]\nC      G\nTexto")).toBe(false);
    expect(hasInlineChords("[C]Texto [G/B]novo")).toBe(true);
    expect(isTraditionalChordLine("[Intro] G  C  G  Em")).toBe(true);
    expect(isTraditionalChordLine("G7/B | C7M(9)  Dsus4 (2x)")).toBe(true);
    expect(isTraditionalChordLine("e|--------0-----| ")).toBe(false);
    expect(isTraditionalChordLine("A graça de Deus")).toBe(false);
    expect(mapTraditionalChordLine("G     D", (symbol) => `${symbol}#`)).toBe("G#    D#");
  });
});

