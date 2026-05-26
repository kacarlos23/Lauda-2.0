import {
  Drum,
  Guitar,
  Handshake,
  HeartHandshake,
  MicVocal,
  MonitorPlay,
  Music2,
  Piano,
  Volume2,
} from "lucide-react-native";
import { INSTRUMENT_CATALOG, FALLBACK_INSTRUMENT_CATALOG_ITEM } from "../constants/instrumentCatalog";
import type { InstrumentCatalogItem } from "../constants/instrumentCatalog";
import { colors } from "../theme";
import type { Instrument } from "../types";

export function normalizeInstrumentName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function resolveInstrumentCatalogItem(name: string): InstrumentCatalogItem {
  const normalized = normalizeInstrumentName(name);
  if (!normalized) return FALLBACK_INSTRUMENT_CATALOG_ITEM;

  const exactMatch = INSTRUMENT_CATALOG.find((item) => {
    const names = [item.displayName, ...item.aliases].map(normalizeInstrumentName);
    return names.includes(normalized);
  });

  if (exactMatch) return exactMatch;

  const partialMatch = INSTRUMENT_CATALOG.find((item) =>
    [item.displayName, ...item.aliases]
      .map(normalizeInstrumentName)
      .some((alias) => alias.length >= 4 && (normalized.includes(alias) || alias.includes(normalized)))
  );

  return partialMatch ?? FALLBACK_INSTRUMENT_CATALOG_ITEM;
}

export function getInstrumentDisplayName(name: string): string {
  const item = resolveInstrumentCatalogItem(name);
  return item.key === FALLBACK_INSTRUMENT_CATALOG_ITEM.key ? name : item.displayName;
}

export function getInstrumentColor(instrument: Instrument): string {
  return instrument.colorHex ?? resolveInstrumentCatalogItem(instrument.name).colorHex ?? FALLBACK_INSTRUMENT_CATALOG_ITEM.colorHex ?? colors.muted;
}

export function renderInstrumentIcon(name: string, selected = false, size = 20) {
  const item = resolveInstrumentCatalogItem(name);
  const iconColor = selected ? colors.surface : item.colorHex ?? colors.primary;
  const iconProps = { color: iconColor, size, strokeWidth: 2.4 };

  switch (item.key) {
    case "vocal":
      return <MicVocal {...iconProps} />;
    case "teclado":
      return <Piano {...iconProps} />;
    case "violao":
    case "guitarra":
    case "baixo":
      return <Guitar {...iconProps} />;
    case "bateria":
      return <Drum {...iconProps} />;
    case "som":
      return <Volume2 {...iconProps} />;
    case "midia":
      return <MonitorPlay {...iconProps} />;
    case "recepcao":
      return <Handshake {...iconProps} />;
    case "intercessao":
      return <HeartHandshake {...iconProps} />;
    default:
      return <Music2 {...iconProps} />;
  }
}
