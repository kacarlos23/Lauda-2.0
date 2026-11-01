import { parseChordSheet, transposeChord, transposeKey, transposeChordSheetContent } from "./chordEngine";

describe("chordEngine", () => {
  it("salva acordes ChordPro e tom sem reescrever texto, seções ou comentários", () => {
    const content = "{title: Canção editada}\r\n{key: G}\r\n{comment: Entrada [C]}\r\n{start_of_chorus}\r\n[G]Grande é o [D/F#]Senhor [Em7]aqui\r\n{end_of_chorus}";
    const saved = transposeChordSheetContent(content, 2, "G");
    expect(saved).toBe(content.replace("{key: G}", "{key: A}").replace("[G]", "[A]").replace("[D/F#]", "[E/G#]").replace("[Em7]", "[F#m7]"));
    expect(parseChordSheet(saved, 0, "A")).toEqual(parseChordSheet(content, 2, "G"));
  });

  it("preserva letras e alinhamento em cifras antigas, inclusive ao acrescentar sustenidos", () => {
    const content = "G        D/F#\r\nGrande é o Senhor\r\n\r\nA graça de Deus\r\nEm7      C\r\nOutra linha editada";
    expect(transposeChordSheetContent(content, 1, "G")).toBe("G#       D#/G\r\nGrande é o Senhor\r\n\r\nA graça de Deus\r\nFm7      C#\r\nOutra linha editada");
  });

  it.each([-11, -2, -1, 1, 2, 11])("reabre cifra em tom menor sem aplicar novamente %i semitons", (offset) => {
    const content = "{k: F#m}\n[F#m]Letra [C#7/E#]com [Dmaj7]baixo";
    const key = transposeKey("F#m", offset);
    const saved = transposeChordSheetContent(content, offset, "F#m");
    expect(saved).toContain(`{k: ${key}}`);
    expect(parseChordSheet(saved, 0, key)).toEqual(parseChordSheet(content, offset, "F#m"));
  });

  it("mantém texto sem acordes e não grava cifras malformadas", () => {
    expect(transposeChordSheetContent("Letra já editada\n\nSegunda linha", 2, "C")).toBe("Letra já editada\n\nSegunda linha");
    expect(transposeChordSheetContent("[C]Texto", 0, "C")).toBe("[C]Texto");
    expect(() => transposeChordSheetContent("[E]Deus é bom\n[Ponte}", 1, "E")).toThrow("Revise o formato");
  });
  it("transpõe acordes, extensões e baixo usando Tonal", () => {
    expect(transposeChord("G7/B", 2)).toBe("A7/C#");
    expect(transposeChord("Bbmaj7", 2, true)).toBe("Cmaj7");
    expect(transposeKey("F#m", 1)).toBe("Gm");
  });

  it("converte ChordPro em linhas renderizáveis", () => {
    const sheet = parseChordSheet("[G]Grande é o [D]Senhor", 2, "G");
    expect(sheet.lines[0].segments).toEqual(expect.arrayContaining([
      expect.objectContaining({ chord: "A", lyrics: "Grande " }),
      expect.objectContaining({ chord: "E", lyrics: "Senhor" }),
    ]));
  });

  it("mantém compatibilidade com cifras antigas", () => {
    const sheet = parseChordSheet("G        D\nGrande é o Senhor", 0, "G");
    expect(sheet.lines.some((line) => line.segments.some((segment) => segment.chord.includes("G")))).toBe(true);
  });

  it("exibe texto simples quando a cifra ChordPro está malformada", () => {
    const malformedContent = "[E]Deus é bom\n[Ponte}\n[( E B D A )]";

    expect(() => parseChordSheet(malformedContent, 0, "E")).not.toThrow();

    const sheet = parseChordSheet(malformedContent, 0, "E");
    expect(sheet.lines).toHaveLength(3);
    expect(sheet.lines[1].segments[0]).toEqual({ chord: "", lyrics: "[Ponte}" });
    expect(sheet.warnings).toContain("Formato de cifra inválido. O conteúdo foi exibido sem formatação.");
  });
});
