import { ChordProParser, ChordsOverWordsParser } from "chordsheetjs";
import { Note } from "tonal";

export type ChordSegment = { chord: string; lyrics: string; annotation?: string };
export type ChordLine = { type: string; segments: ChordSegment[] };
export type RenderableChordSheet = { lines: ChordLine[]; warnings: string[] };

const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const CHORD = /^([A-G](?:#|b)?)(.*?)(?:\/([A-G](?:#|b)?))?$/;

function shiftedNote(note: string, semitones: number, preferFlats: boolean) {
  const chroma = Note.chroma(note);
  if (chroma === undefined) return note;
  return (preferFlats ? FLATS : SHARPS)[(chroma + semitones % 12 + 12) % 12];
}

export function transposeChord(symbol: string, semitones: number, preferFlats = symbol.includes("b")) {
  if (!symbol || semitones === 0) return symbol;
  return symbol.split(/([\s,|]+)/).map((token) => {
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
  const isChordPro = /\[[A-G][#b]?(?:[^\]]*)\]|\{(?:start_of_|soc|title:|key:)/i.test(content);
  const parser = isChordPro ? new ChordProParser() : new ChordsOverWordsParser();
  let song: { lines?: ParserLine[]; warnings?: Array<{ message?: string } | string> };

  try {
    song = parser.parse(content) as unknown as typeof song;
  } catch {
    return plainTextFallback(content);
  }

  const preferFlats = originalKey.includes("b");

  return {
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
