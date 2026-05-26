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
  {
    key: "outro",
    displayName: "Outro",
    aliases: [],
    colorHex: "#64748B",
  },
];

export const FALLBACK_INSTRUMENT_CATALOG_ITEM = INSTRUMENT_CATALOG.find((item) => item.key === "outro")!;
