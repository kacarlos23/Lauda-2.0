export type InstrumentCatalogItem = {
  key: string;
  displayName: string;
  aliases: string[];
  colorHex?: string;
};

export const INSTRUMENT_CATALOG: InstrumentCatalogItem[] = [
  {
    key: "vocal",
    displayName: "Vocal",
    aliases: ["vocal", "voz", "cantor", "cantora", "vocalista"],
    colorHex: "#10B981",
  },
  {
    key: "teclado",
    displayName: "Teclado",
    aliases: ["teclado", "piano", "pianista", "tecladista"],
    colorHex: "#2563EB",
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
    key: "som",
    displayName: "Som",
    aliases: ["som", "audio", "áudio", "operador de som"],
    colorHex: "#0F766E",
  },
  {
    key: "midia",
    displayName: "Mídia",
    aliases: ["midia", "mídia", "projecao", "projeção", "slides"],
    colorHex: "#7C3AED",
  },
  {
    key: "recepcao",
    displayName: "Recepção",
    aliases: ["recepcao", "recepção", "recepcionista"],
    colorHex: "#0891B2",
  },
  {
    key: "intercessao",
    displayName: "Intercessão",
    aliases: ["intercessao", "intercessão", "oração", "oracao"],
    colorHex: "#BE185D",
  },
  {
    key: "outro",
    displayName: "Outro",
    aliases: [],
    colorHex: "#64748B",
  },
];

export const FALLBACK_INSTRUMENT_CATALOG_ITEM = INSTRUMENT_CATALOG.find((item) => item.key === "outro")!;
