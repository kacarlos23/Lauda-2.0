import React from "react";
import Svg, { Path, Circle, Rect, Ellipse } from "react-native-svg";
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

export function getInstrumentColor(instrument: Pick<Instrument, "name" | "colorHex">): string {
  return instrument.colorHex ?? resolveInstrumentCatalogItem(instrument.name).colorHex ?? FALLBACK_INSTRUMENT_CATALOG_ITEM.colorHex ?? colors.muted;
}

// Small vector drawings share a 24-unit canvas and remain sharp on web and native.
export function InstrumentGlyph({ iconKey, size = 18, color = colors.white }: { iconKey: string; size?: number; color?: string }) {
  let drawing;
  switch (iconKey) {
    case "back_vocal": drawing = <><Rect x="9" y="2" width="6" height="12" rx="3" /><Path d="M6 9v3a6 6 0 0 0 12 0V9M12 18v4M8 22h8M9 6h6M9 9h6" /></>; break;
    case "vocalista": drawing = <><Circle cx="16" cy="6" r="4" /><Path d="m13 9-9 9-1 3 3-1 9-9M13 3l6 6M4 18l2 2" /></>; break;
    case "baixo": drawing = <><Path d="m12 12 7-9 2 1-7 10c4 4-1 9-5 7-4-1-5-6-2-8 2-2 2 2 5-1ZM18 4l3 2M17 6l3 2M9 17l9-12M8 18h3" /></>; break;
    case "guitarra": drawing = <><Path d="m12 12 7-9 2 2-8 9 1 4-4 4-7-5 2-5 4 1 1-5 2 4ZM8 18 19 5M17 3l4 3" /></>; break;
    case "violao": case "ukulele": drawing = <><Path d="M12 9c-3-3-7 0-6 3-6 1-5 7-1 9 4 3 9 0 8-4 3-1 4-5 1-6l5-7-2-1-5 6ZM17 3l3 2M6 18l3 2" /><Circle cx="10" cy="14" r={iconKey === "ukulele" ? 1 : 2} /><Path d="m11 13 7-9" /></>; break;
    case "bateria": drawing = <><Circle cx="12" cy="16" r="5" /><Circle cx="12" cy="16" r="3.4" /><Path d="M5 12H2v5h4M18 12h4v5h-4M7 10h4V6H7ZM13 6h4v4h-4M4 6v15M20 6v15M1 4l6 2M17 6l6-2M2 22l2-2 2 2M18 22l2-2 2 2" /></>; break;
    case "flauta": drawing = <><Path d="m3 19 16-16 2 2L5 21ZM16 6l2 2M7 17l1-1M10 14l1-1M13 11l1-1M18 2l4 4" /></>; break;
    case "mesa_som": drawing = <><Path d="M4 2v5m0 4v11M12 2v10m0 4v6M20 2v4m0 4v12" /><Rect x="2" y="7" width="4" height="4" rx="1" /><Rect x="10" y="12" width="4" height="4" rx="1" /><Rect x="18" y="6" width="4" height="4" rx="1" /></>; break;
    case "multimidia": drawing = <><Rect x="2" y="3" width="20" height="14" rx="2" /><Path d="m10 7 5 3-5 3ZM12 17v4M7 21h10" /></>; break;
    case "teclado": drawing = <><Rect x="2" y="5" width="20" height="15" rx="1" /><Path d="M2 9h20M6 9v11M10 9v11M14 9v11M18 9v11M5 6h1M9 6h1" /><Path d="M6 9v5M10 9v5M18 9v5" strokeWidth="3" /></>; break;
    case "piano": drawing = <><Path d="M3 17V8a5 5 0 0 1 8-4c3 2 0 6 7 6 2 0 3 3 3 7ZM3 17h18v4H3ZM7 17v4M11 17v4M15 17v4M19 17v4M5 21v2M19 21v2" /></>; break;
    case "saxofone": drawing = <><Path d="M3 3h5l4 15a4 4 0 0 0 8-1v-5l-5-2v7a1 1 0 0 1-2 0L10 4 8 2H4M15 10l6 2M12 8l2 1M13 11l2 1M14 14l2 1" /></>; break;
    case "violino": case "violoncelo": drawing = <><Path d="m12 8 5-6 2 2-5 6c3 2 3 4 0 5 2 4-3 8-7 5-4-2-4-7 0-8-1-2 1-4 3-3ZM9 16l8-12M8 17l3 2M19 9 13 22M7 21l-1 2" /><Path d="m7 13 2 1M12 16l1 1" /></>; break;
    case "cajon": drawing = <><Path d="m5 3 12-1 3 3v16L8 23l-3-3ZM5 3l3 3 12-1M8 6v17" /><Circle cx="14" cy="16" r="2.5" /></>; break;
    case "pandeiro": drawing = <><Circle cx="12" cy="12" r="9" /><Circle cx="12" cy="12" r="6" /><Path d="M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3M3 12h3M18 12h3M12 3v3M12 18v3" /></>; break;
    case "tamborim": drawing = <><Ellipse cx="10" cy="9" rx="7" ry="4" /><Path d="M3 9v7c0 5 14 5 14 0V9M5 12v5M15 12v5M16 4l5-3M17 6l5-2" /></>; break;
    case "congas": drawing = <><Ellipse cx="7" cy="5" rx="5" ry="2" /><Path d="M2 5l2 16h6l2-16M4 9h6" /><Ellipse cx="18" cy="9" rx="4" ry="2" /><Path d="m14 9 1 12h6l1-12M16 13h4" /></>; break;
    case "acordeon": drawing = <><Rect x="2" y="5" width="5" height="15" rx="1" /><Rect x="17" y="5" width="5" height="15" rx="1" /><Path d="m7 6 2-1 2 1 2-1 2 1 2-1M7 19l2 1 2-1 2 1 2-1 2 1M9 5v15M12 6v13M15 5v15M2 9h5M2 13h5M2 17h5M19 8h1M19 12h1M19 16h1" /></>; break;
    case "trompete": drawing = <><Path d="M2 12h15l5-5v14l-5-5H5a3 3 0 0 1 0-6h8v3M7 12V6M11 12V6M15 12V6M5 6h4M9 6h4M13 6h4M2 11v3" /></>; break;
    case "trombone": drawing = <><Path d="M2 8h14l6-5v12l-6-4H6v7h11a2 2 0 0 0 0-4H9M2 7v3M9 11v7" /></>; break;
    case "harpa": drawing = <><Path d="M4 3c6 6 10-6 16 1l-3 17H9L4 3ZM7 6l4 15M10 6l3 15M14 5l1 16M17 4v17" /></>; break;
    case "regente": drawing = <><Circle cx="12" cy="4" r="2" /><Path d="M12 7v9M12 9l-5 3-4-4M12 9l5 3 3-7M9 22l3-6 3 6M20 5l2-4" /></>; break;
    case "fone": drawing = <><Path d="M3 14v-3a9 9 0 0 1 18 0v3" /><Rect x="3" y="12" width="4" height="9" rx="2" /><Rect x="17" y="12" width="4" height="9" rx="2" /></>; break;
    default: drawing = <><Path d="M10 18V5l10-2v13M10 8l10-2" /><Ellipse cx="7" cy="18" rx="3" ry="2" /><Ellipse cx="17" cy="16" rx="3" ry="2" /></>;
  }
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">{drawing}</Svg>;
}

export function getInstrumentIconKey(instrument: Pick<Instrument, "name" | "iconKey">): string {
  return INSTRUMENT_CATALOG.some((item) => item.key === instrument.iconKey)
    ? instrument.iconKey! : resolveInstrumentCatalogItem(instrument.name).key;
}

export function renderInstrumentIcon(name: string, selected = false, size = 20) {
  const item = resolveInstrumentCatalogItem(name);
  return <InstrumentGlyph iconKey={item.key} color={selected ? colors.surface : item.colorHex ?? colors.primary} size={size} />;
}
