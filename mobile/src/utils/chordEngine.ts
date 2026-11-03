import { ChordProParser, ChordsOverWordsParser } from "chordsheetjs";
import { Note } from "tonal";
import { hasInlineChords, isChordSymbol, isTraditionalChordLine, mapTraditionalChordLine, normalizeChordText } from "../../../src/utils/chordText";

export type ChordSegment = { chord: string; lyrics: string; annotation?: string };
export type ChordLine = { type: string; segments: ChordSegment[] };
export type TraditionalChordRow = { text: string; chord: boolean };
export type RenderableChordSheet = { lines: ChordLine[]; warnings: string[]; traditionalRows?: TraditionalChordRow[] };

const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const CHORD = /^([A-G](?:#|b)?)(.*?)(?:\/([A-G](?:#|b)?))?$/;

function shiftedNote(note: string, semitones: number, preferFlats: boolean) {
  const chroma = Note.chroma(note);
  if (chroma === undefined) return note;
  return (preferFlats ? FLATS : SHARPS)[(chroma + semitones % 12 + 12) % 12];
}

export function transposeChord(symbol: string, semitones: number, preferFlats = symbol.includes("b")): string {
  if (!symbol || semitones === 0) return symbol;
  return symbol.split(/([\s,|]+)/).map((token) => {
    if (!isChordSymbol(token)) return token;
    if (token.startsWith("(") && token.endsWith(")")) return `(${transposeChord(token.slice(1, -1), semitones, preferFlats)})`;
    const match = token.match(CHORD);
    if (!match) return token;
    const [, root, suffix, bass] = match;
    return `${shiftedNote(root, semitones, preferFlats)}${suffix}${bass ? `/${shiftedNote(bass, semitones, preferFlats)}` : ""}`;
  }).join("");
}

export function transposeKey(key: string, semitones: number) {
  const match = key.match(/^([A-G](?:#|b)?)(m?)$/);
  if (!match) return key;
  return `${shiftedNote(match[1], semitones, key.includes("b"))}${match[2]}`;
}

type ParserItem = { chords?: string; lyrics?: string; annotation?: string };
type ParserLine = { type?: string; items?: ParserItem[] };

/** Rebase the stored sheet without rewriting lyrics, comments or section markup. */
export function transposeChordSheetContent(content: string, semitones: number, originalKey: string): string {
  if (!semitones) return content;
  const preferFlats = originalKey.includes("b");
  content = normalizeChordText(content);
  const isChordPro = hasInlineChords(content);
  const parser = isChordPro ? new ChordProParser() : new ChordsOverWordsParser();
  try {
    parser.parse(content);
  } catch {
    throw new Error("Revise o formato da cifra antes de salvar o tom como padrão.");
  }

  const transposeDirective = (directive: string) => directive.replace(
    /^(\{\s*(?:key|k)\s*:\s*)([A-G](?:#|b)?m?)(\s*\})$/i,
    (_, prefix: string, key: string, suffix: string) => `${prefix}${transposeKey(key, semitones)}${suffix}`
  );
  if (isChordPro) {
    return content.replace(/\{[^}\r\n]*\}|\[[^\]\r\n]*\]/g, (token) => token.startsWith("{")
      ? transposeDirective(token)
      : `[${transposeChord(token.slice(1, -1), semitones, preferFlats)}]`);
  }

  return content.split(/(\r?\n)/).map((line) => {
    if (!line || /^\r?\n$/.test(line)) return line;
    if (line.trimStart().startsWith("{")) return line.replace(/\{[^}]*\}/g, transposeDirective);
    return mapTraditionalChordLine(line, (symbol) => transposeChord(symbol, semitones, preferFlats));
  }).join("");
}

function plainTextFallback(content: string): RenderableChordSheet {
  return {
    lines: content.split(/\r?\n/).map((lyrics) => ({
      type: "none",
      segments: lyrics ? [{ chord: "", lyrics }] : [],
    })),
    warnings: ["Formato de cifra inválido. O conteúdo foi exibido sem formatação."],
  };
}

export function parseChordSheet(content: string, semitones = 0, originalKey = "C"): RenderableChordSheet {
  content = normalizeChordText(content);
  const isChordPro = hasInlineChords(content);
  const parser = isChordPro ? new ChordProParser() : new ChordsOverWordsParser();
  let song: { lines?: ParserLine[]; warnings?: Array<{ message?: string } | string> };

  try {
    song = parser.parse(content) as unknown as typeof song;
  } catch {
    return plainTextFallback(content);
  }

  const preferFlats = originalKey.includes("b");

  return {
    ...(!isChordPro ? { traditionalRows: content.split(/\r?\n/).map((text) => ({
      text: mapTraditionalChordLine(text, (symbol) => transposeChord(symbol, semitones, preferFlats)),
      chord: isTraditionalChordLine(text),
    })) } : {}),
    lines: (song.lines ?? []).map((line) => ({
      type: line.type ?? "none",
      segments: (line.items ?? [])
        .filter((item) => typeof item.chords === "string" || typeof item.lyrics === "string")
        .map((item) => ({
          chord: transposeChord(item.chords ?? "", semitones, preferFlats),
          lyrics: item.lyrics ?? "",
          annotation: item.annotation || undefined,
        })),
    })),
    warnings: (song.warnings ?? []).map((warning) => typeof warning === "string" ? warning : warning.message ?? "Formato ChordPro inválido"),
  };
}
