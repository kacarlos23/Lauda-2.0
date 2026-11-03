import { changeChord, editorLines, graphemeCells, insertChord, isChordSymbol, legacyConversion, moveChord, paletteChords, removeEditorLine, replaceLineLyrics, serializeEditorLine } from "./visualChordEditor";

describe("visual chord editing without rewriting unrelated source", () => {
  test("removes a middle line and all its chords while preserving adjacent source", () => {
    expect(removeEditorLine("{comment: Verso}\r\n[C]Vou [G]cantar\r\n[Am]Coração\r\n", 1)).toBe("{comment: Verso}\r\n[Am]Coração\r\n");
  });
  test.each([
    ["[C]Primeira\nÚltima", 0, "Última"],
    ["Primeira\n[G]Última", 1, "Primeira"],
    ["Primeira\r\n\r\nÚltima", 1, "Primeira\r\nÚltima"],
    ["Primeira\r\n", 1, "Primeira"],
    ["[C] [G/B]", 0, ""],
    ["", 0, ""],
  ])("removes boundary, empty or instrumental line without phantom blanks", (source, index, expected) => {
    expect(removeEditorLine(source as string, index as number)).toBe(expected);
  });
  test("does not delete structural directives or tablature through a lyric action", () => {
    expect(() => removeEditorLine("{soc}\n[C]Eu\n{eoc}", 0)).toThrow();
    expect(() => removeEditorLine("{sot}\nE|--0--\n{eot}", 1)).toThrow();
    expect(() => removeEditorLine("Eu", 3)).toThrow();
  });
  test("keeps CRLF, metadata, comments, blanks and instrumental chords verbatim", () => {
    const source = "{title: Canção}\r\n{comment: Intro}\r\n[C] [G/B]\r\n\r\n[C]Vou te can[G]tar\r\n";
    expect(editorLines(source).map(line => line.raw + line.ending).join("")).toBe(source);
    expect(insertChord(source, 4, 4, "Am7")).toBe(source.replace("Vou te", "Vou [Am7]te"));
    expect(paletteChords(source)).toEqual(["C", "G/B", "G"]);
  });
  test.each(["C", "G/B", "C#m7", "Bb9", "D7(9)", "C7M", "F#m7(b5)", "C6/9", "B♭maj7"])("accepts %s", chord => expect(isChordSymbol(chord)).toBe(true));
  test.each(["", "Hello", "Coda", "Amor", "[C]", "C\nG", "C<script>"])("rejects a non-chord %s", chord => expect(isChordSymbol(chord)).toBe(false));
  test("inserts inside a word without changing its letters; does not duplicate identical marks", () => {
    const source = "Vou te cantar";
    expect(insertChord(source, 0, 10, "G")).toBe("Vou te can[G]tar");
    expect(insertChord("[C]Vou", 0, 0, "C")).toBe("[C]Vou");
  });
  test("normalizes new accidentals for transposition while leaving existing source intact", () => {
    expect(insertChord("Eu canto", 0, 3, " F♯m7(♭5) ")).toBe("Eu [F#m7(b5)]canto");
    expect(insertChord("[B♭]Eu", 0, 0, "Bb")).toBe("[B♭]Eu");
    expect(changeChord("[C]Eu", 0, 0, "B♭maj7")).toBe("[Bbmaj7]Eu");
  });
  test("treats accents, surrogate pairs and joined emoji as whole characters", () => {
    const text = "a\u0301 👩‍🎤é";
    expect(graphemeCells(text).map(cell => cell.text)).toEqual(["a\u0301", " ", "👩‍🎤", "é"]);
    expect(() => insertChord(text, 0, 1, "C")).toThrow();
    expect(insertChord(text, 0, 3, "C")).toBe("a\u0301 [C]👩‍🎤é");
  });
  test("supports multiple chords at one anchor and chord-only lines", () => {
    expect(serializeEditorLine("", [{ position: 0, chord: "C" }, { position: 0, chord: "G" }])).toBe("[C][G]");
    expect(changeChord("[C][G]Eu", 0, 0, null)).toBe("[G]Eu");
  });
  test("moves between lines atomically and preserves unrelated directives", () => {
    expect(moveChord("[C]Vou\r\n{comment: Ponte}\r\ncan[G]tar", 0, 0, 2, 0)).toBe("Vou\r\n{comment: Ponte}\r\n[C]can[G]tar");
    expect(() => moveChord("[C]Vou\n{comment: Ponte}", 0, 0, 1, 0)).toThrow();
  });
  test("shifts anchors after inserted lyrics and reports chords in deleted text", () => {
    expect(replaceLineLyrics("Vou te [G]cantar", 0, "Hoje vou te cantar").content).toBe("Hoje vou te [G]cantar");
    const removed = replaceLineLyrics("Vou te [G]cantar", 0, "Vou te ");
    expect(removed.content).toBe("Vou te ");
    expect(removed.removed).toEqual([{ position: 7, chord: "G" }]);
  });
  test("appending lyrics keeps existing chords and allows line breaks", () => {
    expect(replaceLineLyrics("[C]Vou\r\n", 0, "Vou cantar\nagora").content).toBe("[C]Vou cantar\r\nagora\r\n");
  });
  test("blocks accidental reinterpretation of directives, annotations and tablature", () => {
    for (const source of ["{comment: [G] Intro}", "[*Coda]Fim", "{start_of_tab}\nE|---0---\n{end_of_tab}", "[Intro]", "{soc}[C]Eu{eoc}"]) {
      const lines = editorLines(source);
      expect(lines[0].protected).toBe(true);
      expect(() => insertChord(source, 0, 0, "C")).toThrow();
    }
    expect(() => replaceLineLyrics("Eu", 0, "[C]Eu")).toThrow();
  });
  test("previews traditional conversion while keeping sections and instrumental repeats", () => {
    const source = "{title: Exemplo}\r\nIntro\r\nC  G/B (2x)\r\n\r\nC      G\r\nVou te cantar\r\n";
    const converted = legacyConversion(source);
    expect(converted.convertedLines).toBe(2);
    expect(converted.content).toBe("{title: Exemplo}\r\nIntro\r\n[C]  [G/B] (2x)\r\n\r\n[C]Vou te [G]cantar\r\n");
  });
  test("leaves existing ChordPro or mixed source untouched", () => {
    const source = "C   G\nEu te canto\n[Am]Senhor";
    expect(legacyConversion(source)).toEqual({ content: source, convertedLines: 0 });
  });
});
