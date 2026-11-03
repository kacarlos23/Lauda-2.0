import { ChordsOverWordsParser } from "chordsheetjs";

export type ChordMark = { position: number; chord: string };
export type EditorLine = { index: number; raw: string; ending: string; lyrics: string; marks: ChordMark[]; protected: boolean };
export type GraphemeCell = { text: string; position: number };
type GraphemeSegmenter = { segment: (value: string) => Iterable<{ segment: string; index: number }> };
let graphemeSegmenter: GraphemeSegmenter | undefined;

/** Offsets are UTF-16 offsets, but every selectable position is a grapheme boundary. */
export function graphemeCells(text: string): GraphemeCell[] {
  const Segmenter = (Intl as unknown as { Segmenter?: new (locale: string, options: { granularity: string }) => GraphemeSegmenter }).Segmenter;
  if (Segmenter) {
    graphemeSegmenter ??= new Segmenter("pt-BR", { granularity: "grapheme" });
    return Array.from(graphemeSegmenter.segment(text), item => ({ text: item.segment, position: item.index }));
  }
  const cells: GraphemeCell[] = [];
  let position = 0;
  for (const character of Array.from(text)) {
    const previous = cells[cells.length - 1];
    if (previous && (/^[\p{M}\uFE0F\u200D]$/u.test(character) || previous.text.endsWith("\u200D"))) previous.text += character;
    else cells.push({ text: character, position });
    position += character.length;
  }
  return cells;
}

export function isChordSymbol(value: string): boolean {
  return /^[A-G](?:#|b|♯|♭)?(?:(?:maj|min|dim|aug|sus|add|omit|alt|no)|[Mm\d#b♯♭()+°ºøΔ^\-]|\/\d+)*(?:\/[A-G](?:#|b|♯|♭)?)?$/.test(value);
}

/** Existing source is preserved; newly entered accidentals use the viewer/exporter's notation. */
export function normalizeEditorChord(chord: string): string {
  return chord.trim().replace(/♯/g, "#").replace(/♭/g, "b");
}

export function editorLines(content: string): EditorLine[] {
  const pieces = content.split(/(\r\n|\n|\r)/);
  const lines: EditorLine[] = [];
  let inTab = false;
  for (let offset = 0; offset < pieces.length; offset += 2) {
    const raw = pieces[offset];
    const isTabStart = /^\s*\{\s*(?:start_of_tab|sot)\s*\}/i.test(raw);
    const isTabEnd = /^\s*\{\s*(?:end_of_tab|eot)\s*\}/i.test(raw);
    const protectedLine = inTab || isTabStart || /[{}]/.test(raw) || /^\s*#/.test(raw);
    let lyrics = "";
    const marks: ChordMark[] = [];
    let cursor = 0;
    let unknown = false;
    for (const token of raw.matchAll(/\[([^\]\r\n]*)\]/g)) {
      lyrics += raw.slice(cursor, token.index);
      if (isChordSymbol(token[1])) marks.push({ position: lyrics.length, chord: token[1] });
      else unknown = true;
      cursor = token.index! + token[0].length;
    }
    lyrics += raw.slice(cursor);
    // Preserve unsupported syntax verbatim, including annotations and tablature.
    const isProtected = protectedLine || unknown || /[\[\]]/.test(lyrics);
    lines.push({ index: lines.length, raw, ending: pieces[offset + 1] ?? "", lyrics: isProtected ? raw : lyrics, marks: isProtected ? [] : marks, protected: isProtected });
    if (isTabStart) inTab = true;
    if (isTabEnd) inTab = false;
  }
  return lines;
}

export function serializeEditorLine(lyrics: string, marks: ChordMark[]): string {
  const ordered = marks.map((mark, index) => ({ ...mark, index })).sort((a, b) => a.position - b.position || a.index - b.index);
  let result = "";
  let cursor = 0;
  for (const mark of ordered) {
    if (!Number.isInteger(mark.position) || mark.position < 0 || mark.position > lyrics.length || !isChordSymbol(mark.chord)) throw new Error("Posição ou acorde inválido.");
    result += lyrics.slice(cursor, mark.position) + `[${mark.chord}]`;
    cursor = mark.position;
  }
  return result + lyrics.slice(cursor);
}

function editableLine(content: string, index: number) {
  const lines = editorLines(content);
  const line = lines[index];
  if (!line || line.protected) throw new Error("Este bloco deve ser editado no modo Texto ChordPro.");
  return { lines, line };
}

function replaceLine(lines: EditorLine[], index: number, raw: string): string {
  return lines.map((line, position) => (position === index ? raw : line.raw) + line.ending).join("");
}

/** Remove the physical line and its chords without leaving a phantom last line. */
export function removeEditorLine(content: string, lineIndex: number): string {
  const { lines } = editableLine(content, lineIndex);
  return lines.map((line, index) => {
    if (index === lineIndex) return "";
    const ending = lineIndex === lines.length - 1 && index === lineIndex - 1 ? "" : line.ending;
    return line.raw + ending;
  }).join("");
}

function assertPosition(line: EditorLine, position: number) {
  if (position !== line.lyrics.length && !graphemeCells(line.lyrics).some(cell => cell.position === position)) throw new Error("Selecione uma letra inteira.");
}

export function insertChord(content: string, lineIndex: number, position: number, chord: string): string {
  chord = normalizeEditorChord(chord);
  if (!isChordSymbol(chord)) throw new Error("Informe um acorde como C, Am7, G/B ou Bb9.");
  const { lines, line } = editableLine(content, lineIndex);
  assertPosition(line, position);
  if (line.marks.some(mark => mark.position === position && normalizeEditorChord(mark.chord) === chord)) return content;
  return replaceLine(lines, lineIndex, serializeEditorLine(line.lyrics, [...line.marks, { position, chord }]));
}

export function changeChord(content: string, lineIndex: number, markIndex: number, chord: string | null): string {
  if (chord !== null) chord = normalizeEditorChord(chord);
  const { lines, line } = editableLine(content, lineIndex);
  if (!line.marks[markIndex]) throw new Error("Acorde não encontrado.");
  if (chord !== null && !isChordSymbol(chord)) throw new Error("Informe um acorde válido.");
  const marks = line.marks.flatMap((mark, index) => index !== markIndex ? [mark] : chord === null ? [] : [{ ...mark, chord }]);
  return replaceLine(lines, lineIndex, serializeEditorLine(line.lyrics, marks));
}

export function moveChord(content: string, fromLine: number, markIndex: number, toLine: number, position: number): string {
  const { line } = editableLine(content, fromLine);
  const target = editableLine(content, toLine).line;
  assertPosition(target, position);
  const mark = line.marks[markIndex];
  if (!mark) throw new Error("Acorde não encontrado.");
  if (fromLine === toLine && mark.position === position) return content;
  return insertChord(changeChord(content, fromLine, markIndex, null), toLine, position, mark.chord);
}

export function replaceLineLyrics(content: string, lineIndex: number, nextLyrics: string): { content: string; removed: ChordMark[] } {
  if (/[\[\]{}]/.test(nextLyrics)) throw new Error("Para editar colchetes e diretivas, use o modo Texto ChordPro.");
  const { lines, line } = editableLine(content, lineIndex);
  const before = graphemeCells(line.lyrics);
  const after = graphemeCells(nextLyrics);
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix].text === after[prefix].text) prefix++;
  let suffix = 0;
  while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - suffix - 1].text === after[after.length - suffix - 1].text) suffix++;
  const start = before[prefix]?.position ?? line.lyrics.length;
  const end = before[before.length - suffix]?.position ?? line.lyrics.length;
  const delta = nextLyrics.length - line.lyrics.length;
  const removed = line.marks.filter(mark => mark.position >= start && mark.position < end);
  const marks = line.marks.filter(mark => !removed.includes(mark)).map(mark => ({ ...mark, position: mark.position >= end ? mark.position + delta : mark.position }));
  const ending = lines.find(item => item.ending)?.ending ?? "\n";
  return { content: replaceLine(lines, lineIndex, serializeEditorLine(nextLyrics, marks).replace(/\r\n|\r|\n/g, ending)), removed };
}

function legacyChordTokens(raw: string): Array<{ chord: string; column: number }> | null {
  if (/[\[\]{}]/.test(raw) || !raw.trim()) return null;
  const expanded = raw.replace(/\t/g, "        ");
  const matches = [...expanded.matchAll(/\S+/g)];
  if (!matches.some(match => isChordSymbol(match[0])) || matches.some(match => !isChordSymbol(match[0]) && !/^(?:[|:%]+|\(?x?\d+x?\)?)$/i.test(match[0]))) return null;
  // Use the same parser as the existing viewer to confirm chord recognition.
  const parsed = new ChordsOverWordsParser().parse(expanded);
  if (!parsed.lines.some(line => line.items.some(item => "chords" in item && Boolean(item.chords)))) return null;
  return matches.filter(match => isChordSymbol(match[0])).map(match => ({ chord: match[0], column: match.index! }));
}

export function legacyConversion(content: string): { content: string; convertedLines: number } {
  // A mixed sheet is kept intact; editing it as text is safer than guessing.
  if (/\[[A-G][^\]\r\n]*\]/.test(content)) return { content, convertedLines: 0 };
  const lines = editorLines(content);
  let result = "";
  let convertedLines = 0;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const chords = line.protected ? null : legacyChordTokens(line.raw);
    if (!chords) { result += line.raw + line.ending; continue; }
    const next = lines[index + 1];
    const chordLineHasAnnotations = line.raw.replace(/\t/g, "        ").trim().split(/\s+/).some(token => !isChordSymbol(token));
    if (next && next.raw.trim() && !next.protected && !legacyChordTokens(next.raw) && !chordLineHasAnnotations && !/^\s*(?:intro|refrão|refr[aã]o|ponte|verso|solo|final|primeira parte|segunda parte)\s*:?(?:\s|$)/i.test(next.raw)) {
      let lyrics = next.raw.replace(/\t/g, "        ");
      const longestColumn = Math.max(...chords.map(mark => mark.column));
      lyrics = lyrics.padEnd(Math.max(Array.from(lyrics).length, longestColumn), " ");
      const marks = chords.map(mark => ({ chord: mark.chord, position: Array.from(lyrics).slice(0, mark.column).join("").length }));
      result += serializeEditorLine(lyrics, marks) + next.ending;
      index++;
    } else result += line.raw.replace(/\S+/g, token => isChordSymbol(token) ? `[${token}]` : token) + line.ending;
    convertedLines++;
  }
  return { content: result, convertedLines };
}

export function paletteChords(content: string): string[] {
  return [...new Set(editorLines(content).flatMap(line => line.marks.map(mark => mark.chord)))];
}
