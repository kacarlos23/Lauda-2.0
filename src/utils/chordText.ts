/** Text conventions shared by import, the viewer, transposition and PDF export. */
export function normalizeChordText(content: string): string {
  return content.replace(/[\u200B\uFEFF]/g, "").replace(/[\u00A0\u202F]/g, " ")
    .split(/(\r?\n)/).map((line) => {
      let addedColumns = 0;
      return line.replace(/\t/g, (_, index: number) => {
        const width = 8 - (index + addedColumns) % 8;
        addedColumns += width - 1;
        return " ".repeat(width);
      });
    }).join("");
}

// Allow common Brazilian spellings (C7M, Em7(9), A7(9/13)) without
// mistaking words such as [Final], [Bridge] or [Amigos] for chords.
const chordSymbol = /^[A-G](?:#|b)?(?:(?:maj|min|dim|aug|sus|add|m|M|ø|°|Δ)|\d|[#b+()\-]|\/(?=\d))*(?:\/[A-G](?:#|b)?)?$/;
export function isChordSymbol(value: string): boolean {
  const symbol = value.startsWith("(") && value.endsWith(")") ? value.slice(1, -1) : value;
  return chordSymbol.test(symbol);
}

export function isTablatureLine(line: string): boolean {
  return /^\s*[A-Ga-g](?:#|b)?\s*\|[-\d]/.test(line);
}

const rowPrefix = /^\s*(?:\[[^\]\r\n]+\]|(?:Intro(?:dução)?|Solo|Final|Ponte|Refr[aã]o|Verso|Interl[uú]dio)\s*:)\s*/i;
const rhythmToken = /^(?:[|:.,/()\-]+|\(?\d+x\)?|x\d+|N\.?C\.?)$/i;

export function isTraditionalChordLine(line: string): boolean {
  if (isTablatureLine(line)) return false;
  const tokens = line.replace(rowPrefix, "").split(/[\s,|]+/).filter(Boolean);
  return tokens.some(isChordSymbol) && tokens.every((token) => isChordSymbol(token) || rhythmToken.test(token));
}

export function hasInlineChords(content: string): boolean {
  return [...content.matchAll(/\[([^\]\r\n]+)\]/g)].some((match) => {
    const tokens = match[1].trim().split(/[\s,|]+/).filter(Boolean);
    return tokens.some(isChordSymbol) && tokens.every((token) => isChordSymbol(token) || rhythmToken.test(token));
  });
}

/** Preserve the original chord columns, moving a neighbour only to avoid overlap. */
export function mapTraditionalChordLine(line: string, transpose: (symbol: string) => string): string {
  if (!isTraditionalChordLine(line)) return line;
  const prefix = line.match(rowPrefix)?.[0] ?? "";
  let result = prefix;
  let end = prefix.length;
  for (const match of line.slice(prefix.length).matchAll(/\S+/g)) {
    const start = prefix.length + match.index!;
    const gap = start - end;
    result += " ".repeat(Math.max(gap ? 1 : 0, start - result.length));
    result += transpose(match[0]);
    end = start + match[0].length;
  }
  return result + line.slice(end);
}
