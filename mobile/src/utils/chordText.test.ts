import { reviewChordText } from "./chordText";
import { parseChordSheet } from "./chordEngine";

describe("reviewChordText", () => {
  it("limpa os caracteres da importação também em uma cifra colada, preservando as colunas", () => {
    const reviewed = reviewChordText("\uFEFFG\u200B\u00A0\u00A0\u00A0\u2060D\u200D\r\nDeus é bom\u00AD");
    expect(reviewed.cleanedContent).toBe("G   D\nDeus é bom");
    expect(reviewed.correctedCharacters).toBe(9);
    expect(reviewed.convertedContent).toBe("[G]Deus[D] é bom");
    expect(reviewed.chordCount).toBe(2);
  });

  it("expande tabulações até a próxima coluna e mantém espaços e linhas em branco", () => {
    const reviewed = reviewChordText("G\tD\nGrande é o Senhor\n\n  Aleluia  ");
    expect(reviewed.cleanedContent).toBe("G       D\nGrande é o Senhor\n\n  Aleluia  ");
    expect(reviewed.convertedContent).toBe("[G]Grande é[D] o Senhor\n\n  Aleluia  ");
  });

  it("converte acidentes, baixos e extensões mantendo cada acorde sobre sua sílaba", () => {
    const reviewed = reviewChordText("F#m7(11)  C7M  Bm7(b5)  E7(9/13)  Bb/D\nCantarei teu amor para sempre, meu Senhor");
    expect(reviewed.chordCount).toBe(5);
    const sheet = parseChordSheet(reviewed.convertedContent, 0, "F#");
    expect(sheet.warnings).toEqual([]);
    expect(sheet.lines.flatMap((line) => line.segments).map((segment) => segment.chord).filter(Boolean))
      .toEqual(["F#m7(11)", "C7M", "Bm7(b5)", "E7(9/13)", "Bb/D"]);
    expect(sheet.lines[0].segments.map((segment) => segment.lyrics).join(""))
      .toBe("Cantarei teu amor para sempre, meu Senhor");
  });

  it("preserva seções, compassos, repetições e sequências instrumentais", () => {
    const reviewed = reviewChordText("[Intro] G  D/F#  Em\n\n|: C G :| 2x\n( E B D A )\nMinha canção\nC\nG\nAleluia");
    expect(reviewed.convertedContent).toBe("[Intro] [G]  [D/F#]  [Em]\n\n|: [C] [G] :| 2x\n( [E] [B] [D] [A] )\nMinha canção\n[C]\n[G]Aleluia");
  });

  it("mantém ChordPro existente e converte só as outras linhas sem duplicar colchetes", () => {
    const input = "[C] A\n[Refrão]\n[G]Deus é [D]bom\n\nC   G\nMeu Senhor\n{comment: Final}\nAm";
    const reviewed = reviewChordText(input);
    expect(reviewed.convertedContent).toBe("[C] A\n[Refrão]\n[G]Deus é [D]bom\n\n[C]Meu [G]Senhor\n{comment: Final}\n[Am]");
    const again = reviewChordText(reviewed.convertedContent);
    expect(again.convertedContent).toBe(reviewed.convertedContent);
    expect(again.chordCount).toBe(0);
    expect(again.correctedCharacters).toBe(0);
  });

  it("não inventa acordes para a letra e preserva texto malformado", () => {
    const input = "A Deus toda glória\nE cantarei para sempre\nAmor e graça\nAleluia\n[Ponte}\n[( E B D A )]";
    expect(reviewChordText(input)).toMatchObject({ cleanedContent: input, convertedContent: input, chordCount: 0 });
  });

  it("mantém acordes além do fim da letra e não consome a próxima seção", () => {
    expect(reviewChordText("C       G   D\nAmém\nE\n[Refrão]").convertedContent)
      .toBe("[C]Amém    [G]    [D]\n[E]\n[Refrão]");
  });

  it("remove controles de direção e normaliza espaços especiais e quebras de linha", () => {
    expect(reviewChordText("\u202AG\u202C\u2009\u202FD\u2028Glória\r\n\n\u061CAm\u2066\u2069").cleanedContent)
      .toBe("G  D\nGlória\n\nAm");
  });
});
