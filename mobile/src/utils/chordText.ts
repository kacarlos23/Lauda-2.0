// Keep spaces as columns: collapsing whitespace moves chords to the wrong syllable.
const INVISIBLE = /[\u0000-\u0008\u000B\u000E-\u001F\u007F\u00AD\u034F\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF]/g;
const SPECIAL_SPACE = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;
const CHORD_SYMBOL = /^[A-G][#b]?(?:(?:maj|min|dim|aug|sus|add|omit|no|m|M|[\d#b+°ºøΔ-])|\((?:maj|min|dim|aug|sus|add|omit|no|m|M|[\d#b+°ºøΔ/,-])+\))*(?:\/(?:[A-G][#b]?|\d+))?$/;
type PositionedChord = { symbol: string; column: number };

function chordRow(line: string): PositionedChord[] | null {
  const chords: PositionedChord[] = [];
  // Labels and bar/repetition markers are preserved on their own line.
  const label = line.match(/^\s*\[([^\]]+)\]/);
  if (label && CHORD_SYMBOL.test(label[1])) return null;
  const body = label ? " ".repeat(label[0].length) + line.slice(label[0].length) : line;
  for (const token of body.matchAll(/\S+/g)) {
    const symbol = token[0].replace(/^[|:()]+|[|:()]+$/g, "");
    // Parentheses in chord extensions belong to the chord, e.g. F#m7(11).
    const chord = CHORD_SYMBOL.test(token[0]) ? token[0] : symbol;
    if (CHORD_SYMBOL.test(chord)) {
      chords.push({ symbol: chord, column: token.index! + token[0].indexOf(chord) });
    } else if (!/^[|:()]+$|^\d+[xX]$/.test(token[0])) {
      return null;
    }
  }
  return chords.length ? chords : null;
}

function markChords(line: string, chords: PositionedChord[]): string {
  let result = line;
  for (const chord of [...chords].reverse()) {
    result = result.slice(0, chord.column) + `[${chord.symbol}]` + result.slice(chord.column + chord.symbol.length);
  }
  return result;
}

function mergeLyrics(lyrics: string, chords: PositionedChord[]): string {
  const characters = Array.from(lyrics);
  let result = "";
  let column = 0;
  for (const chord of chords) {
    result += characters.slice(column, chord.column).join("");
    if (chord.column > characters.length) result += " ".repeat(chord.column - Math.max(column, characters.length));
    result += `[${chord.symbol}]`;
    column = chord.column;
  }
  return result + characters.slice(column).join("");
}

export function reviewChordText(content: string) {
  let correctedCharacters = 0;
  const cleanedContent = content
    .replace(INVISIBLE, () => { correctedCharacters++; return ""; })
    .replace(SPECIAL_SPACE, () => { correctedCharacters++; return " "; })
    .replace(/\r\n|\r|[\u2028\u2029]/g, () => { correctedCharacters++; return "\n"; })
    .split("\n")
    .map((line) => {
      let column = 0;
      return Array.from(line).map((character) => {
        if (character !== "\t") { column++; return character; }
        correctedCharacters++;
        const spaces = 8 - column % 8;
        column += spaces;
        return " ".repeat(spaces);
      }).join("");
    }).join("\n");

  const lines = cleanedContent.split("\n");
  const rows = lines.map(chordRow);
  const converted: string[] = [];
  let chordCount = 0;
  for (let index = 0; index < lines.length; index++) {
    const chords = rows[index];
    if (!chords) { converted.push(lines[index]); continue; }
    chordCount += chords.length;
    const nextLine = lines[index + 1];
    // Never merge over another chord row, a section, or existing ChordPro.
    const canMerge = nextLine?.trim() && !rows[index + 1]
      && !/[\[\]{}]/.test(nextLine)
      && lines[index].trim().split(/\s+/).every((token) => CHORD_SYMBOL.test(token));
    if (canMerge) {
      converted.push(mergeLyrics(nextLine, chords));
      index++;
    } else {
      converted.push(markChords(lines[index], chords));
    }
  }
  return { cleanedContent, convertedContent: converted.join("\n"), correctedCharacters, chordCount };
}
