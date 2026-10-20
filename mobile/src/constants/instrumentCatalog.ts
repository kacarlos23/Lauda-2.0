export type InstrumentCatalogItem = {
  key: string;
  displayName: string;
  aliases: string[];
  colorHex?: string;
};

export const INSTRUMENT_CATALOG: InstrumentCatalogItem[] = [
  {
    key: "vocalista",
    displayName: "Vocalista",
    aliases: ["vocalista", "vocal", "voz", "cantor", "cantora"],
    colorHex: "#10B981",
  },
  {
    key: "violao",
    displayName: "Violão",
    aliases: ["violao", "violão", "violonista"],
    colorHex: "#F59E0B",
  },
  {
    key: "guitarra",
    displayName: "Guitarra",
    aliases: ["guitarra", "guitarrista"],
    colorHex: "#EF4444",
  },
  {
    key: "baixo",
    displayName: "Baixo",
    aliases: ["baixo", "baixista", "contrabaixo"],
    colorHex: "#8B5CF6",
  },
  {
    key: "bateria",
    displayName: "Bateria",
    aliases: ["bateria", "baterista", "percussao", "percussão"],
    colorHex: "#DC2626",
  },
  {
    key: "teclado",
    displayName: "Teclado",
    aliases: ["teclado", "tecladista"],
    colorHex: "#2563EB",
  },
  {
    key: "piano",
    displayName: "Piano",
    aliases: ["piano", "pianista"],
    colorHex: "#2563EB",
  },
  {
    key: "violino",
    displayName: "Violino",
    aliases: ["violino", "violinista"],
    colorHex: "#A855F7",
  },
  {
    key: "flauta",
    displayName: "Flauta",
    aliases: ["flauta", "flautista"],
    colorHex: "#14B8A6",
  },
  {
    key: "mesa_som",
    displayName: "Mesa de Som",
    aliases: ["mesa de som", "som", "audio", "áudio", "operador de som"],
    colorHex: "#0F766E",
  },
  {
    key: "saxofone",
    displayName: "Saxofone",
    aliases: ["saxofone", "sax", "saxofonista"],
    colorHex: "#D97706",
  },
  {
    key: "back_vocal",
    displayName: "Back Vocal",
    aliases: ["back vocal", "backing vocal", "back", "apoio vocal"],
    colorHex: "#22C55E",
  },
  {
    key: "multimidia",
    displayName: "Multimídia",
    aliases: ["multimidia", "multimídia", "midia", "mídia", "projecao", "projeção", "slides"],
    colorHex: "#7C3AED",
  },
  {"key": "cajon", "displayName": "Cajón", "aliases": ["cajon", "cajón"], "colorHex": "#B45309"},
  {"key": "pandeiro", "displayName": "Pandeiro", "aliases": ["pandeiro"], "colorHex": "#D97706"},
  {"key": "tamborim", "displayName": "Tamborim", "aliases": ["tamborim"], "colorHex": "#EA580C"},
  {"key": "congas", "displayName": "Congas", "aliases": ["conga", "congas", "percussao", "percussão"], "colorHex": "#C2410C"},
  {"key": "acordeon", "displayName": "Acordeon", "aliases": ["acordeon", "acordeão", "sanfona"], "colorHex": "#4F46E5"},
  {"key": "trompete", "displayName": "Trompete", "aliases": ["trompete", "pistom"], "colorHex": "#CA8A04"},
  {"key": "trombone", "displayName": "Trombone", "aliases": ["trombone"], "colorHex": "#A16207"},
  {"key": "violoncelo", "displayName": "Violoncelo", "aliases": ["violoncelo", "cello"], "colorHex": "#9333EA"},
  {"key": "harpa", "displayName": "Harpa", "aliases": ["harpa"], "colorHex": "#DB2777"},
  {"key": "ukulele", "displayName": "Ukulele", "aliases": ["ukulele", "ukulelê"], "colorHex": "#65A30D"},
  {"key": "regente", "displayName": "Regente", "aliases": ["regente", "maestro", "maestrina"], "colorHex": "#475569"},
  {"key": "fone", "displayName": "Retorno / monitoração", "aliases": ["retorno", "monitoracao", "monitoração"], "colorHex": "#0369A1"},
  {
    key: "outro",
    displayName: "Outro",
    aliases: [],
    colorHex: "#64748B",
  },
];

export const FALLBACK_INSTRUMENT_CATALOG_ITEM = INSTRUMENT_CATALOG.find((item) => item.key === "outro")!;

export const INSTRUMENT_COLORS = ["#22C55E", "#10B981", "#1F6F55", "#0F766E", "#14B8A6", "#06B6D4", "#0284C7", "#2563EB", "#4F46E5", "#7C3AED", "#8B5CF6", "#A855F7", "#C026D3", "#DB2777", "#E11D48", "#EF4444", "#DC2626", "#EA580C", "#D97706", "#F59E0B", "#CA8A04", "#65A30D", "#475569", "#13231D"];
