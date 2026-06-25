import { parseChordSheet, transposeChord, transposeKey } from "./chordEngine";

describe("chordEngine", () => {
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
