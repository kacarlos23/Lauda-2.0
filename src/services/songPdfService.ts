import path from "path";
import PDFDocument from "pdfkit";
import { Prisma } from "@prisma/client";
import { songSelect } from "../repositories/songRepository";

type ExportSong = Prisma.SongGetPayload<{ select: typeof songSelect }>;
type ExportSongInput = ExportSong & { semitoneOffset?: number };

const fontRoot = path.join(path.dirname(require.resolve("dejavu-fonts-ttf/package.json")), "ttf");
const regularFont = path.join(fontRoot, "DejaVuSans.ttf");
const boldFont = path.join(fontRoot, "DejaVuSans-Bold.ttf");
const monoFont = path.join(fontRoot, "DejaVuSansMono.ttf");
const monoBoldFont = path.join(fontRoot, "DejaVuSansMono-Bold.ttf");

type PrintableLine = { kind: "chord" | "lyrics" | "section" | "blank"; text: string };

const chordToken = /^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add|M)?\d*(?:[()/+#b0-9-]*)?$/;
const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const CHORD = /^([A-G](?:#|b)?)(.*?)(?:\/([A-G](?:#|b)?))?$/;
const NOTE_INDEX = new Map<string, number>([
  ["C", 0], ["B#", 0],
  ["C#", 1], ["Db", 1],
  ["D", 2],
  ["D#", 3], ["Eb", 3],
  ["E", 4], ["Fb", 4],
  ["F", 5], ["E#", 5],
  ["F#", 6], ["Gb", 6],
  ["G", 7],
  ["G#", 8], ["Ab", 8],
  ["A", 9],
  ["A#", 10], ["Bb", 10],
  ["B", 11], ["Cb", 11],
]);

function shiftedNote(note: string, semitones: number, preferFlats: boolean) {
  const chroma = NOTE_INDEX.get(note);
  if (chroma === undefined) return note;
  return (preferFlats ? FLATS : SHARPS)[(chroma + semitones % 12 + 12) % 12];
}

function transposeChord(symbol: string, semitones: number, preferFlats = symbol.includes("b")) {
  if (!symbol || semitones === 0) return symbol;
  return symbol.split(/([\s,|]+)/).map((token) => {
    const match = token.match(CHORD);
    if (!match) return token;
    const [, root, suffix, bass] = match;
    return `${shiftedNote(root, semitones, preferFlats)}${suffix}${bass ? `/${shiftedNote(bass, semitones, preferFlats)}` : ""}`;
  }).join("");
}

function transposeKey(key: string, semitones: number) {
  const match = key.match(/^([A-G](?:#|b)?)(m?)$/);
  if (!match) return key;
  return `${shiftedNote(match[1], semitones, key.includes("b"))}${match[2]}`;
}

function isLegacyChordLine(line: string) {
  const tokens = line.trim().replace(/[|,]/g, " ").split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => chordToken.test(token));
}

function printableChordPro(content: string, semitones = 0, originalKey = "C"): PrintableLine[] {
  const preferFlats = originalKey.includes("b");
  return content.split("\n").flatMap((line): PrintableLine[] => {
    const directive = line.match(/^\{(?:start_of_)?(chorus|verse|bridge|tab)(?::[^}]*)?\}$/i);
    if (directive) return [{ kind: "section", text: directive[1].toUpperCase() }];
    if (/^\{[^}]+\}$/.test(line)) return [];
    if (!line) return [{ kind: "blank", text: " " }];
    const chordLine: string[] = [];
    let lyrics = "";
    let cursor = 0;
    for (const match of line.matchAll(/\[([^\]]+)\]/g)) {
      const text = line.slice(cursor, match.index);
      lyrics += text;
      while (chordLine.length < lyrics.length) chordLine.push(" ");
      transposeChord(match[1], semitones, preferFlats).split("").forEach((character, index) => { chordLine[lyrics.length + index] = character; });
      cursor = (match.index ?? 0) + match[0].length;
    }
    if (!cursor) {
      const isChord = isLegacyChordLine(line);
      return [{ kind: isChord ? "chord" : "lyrics", text: isChord ? transposeChord(line, semitones, preferFlats) : line }];
    }
    lyrics += line.slice(cursor);
    return [
      { kind: "chord", text: chordLine.join("").trimEnd() },
      { kind: "lyrics", text: lyrics || " " },
    ];
  });
}

export class SongPdfService {
  generate(songs: ExportSongInput[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margins: { top: 54, right: 48, bottom: 54, left: 48 }, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("error", reject);
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      doc.registerFont("Body", regularFont);
      doc.registerFont("Bold", boldFont);
      doc.registerFont("Mono", monoFont);
      doc.registerFont("MonoBold", monoBoldFont);

      songs.forEach((song, index) => {
        const semitoneOffset = song.semitoneOffset ?? 0;
        const displayKey = transposeKey(song.originalKey, semitoneOffset);
        if (index > 0) doc.addPage();
        doc.font("Bold").fontSize(20).fillColor("#17211A").text(song.title, { align: "center" });
        doc.moveDown(0.35);
        doc.font("Body").fontSize(11).fillColor("#2D3A31").text(`Artista: ${song.artist.name}`);
        if (song.composer) doc.text(`Compositor: ${song.composer}`);
        doc.text(`Tom: ${displayKey}${song.bpm ? ` · ${song.bpm} BPM` : ""}`);
        doc.moveDown(0.8);
        doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - 48, doc.y).strokeColor("#DDE4DA").stroke();
        doc.moveDown(0.8);
        printableChordPro(song.content, semitoneOffset, song.originalKey).forEach((line) => {
          if (line.kind === "section") {
            doc.moveDown(0.45).font("Bold").fontSize(9).fillColor("#667267").text(line.text, { characterSpacing: 0.7 });
            return;
          }
          if (line.kind === "blank") {
            doc.moveDown(0.55);
            return;
          }
          const isChord = line.kind === "chord";
          doc.font(isChord ? "MonoBold" : "Mono")
            .fontSize(isChord ? 10.5 : 10)
            .fillColor(isChord ? "#1F6F55" : "#17211A")
            .text(line.text || " ", {
              lineGap: isChord ? 0 : 2,
              width: doc.page.width - 96,
              align: "left",
            });
        });
      });

      const range = doc.bufferedPageRange();
      for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
        doc.switchToPage(pageIndex);
        doc.font("Body").fontSize(8).fillColor("#667267").text(
          `${pageIndex + 1} / ${range.count}`,
          48,
          doc.page.height - doc.page.margins.bottom - 10,
          { width: doc.page.width - 96, align: "center", lineBreak: false }
        );
      }

      doc.end();
    });
  }
}
