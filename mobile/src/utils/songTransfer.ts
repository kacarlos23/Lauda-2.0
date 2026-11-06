import type { SongTransferDocument } from "../services/musicService";

export function parseSongTransferDocument(raw: string): SongTransferDocument {
  // UTF-8 files saved by Windows editors can start with a byte order mark.
  const document: unknown = JSON.parse(raw.replace(/^\uFEFF/, ""));
  if (!document || typeof document !== "object" || Array.isArray(document) ||
      !("format" in document) || document.format !== "lauda.music-catalog") {
    throw new Error("Selecione um arquivo JSON de músicas exportado pelo Lauda. PDFs de cifras não podem ser importados.");
  }
  if (!("version" in document) || document.version !== 1) {
    throw new Error("A versão deste arquivo não é compatível com o Lauda. Exporte o catálogo novamente.");
  }
  if (!("songs" in document) || !Array.isArray(document.songs) || !document.songs.length) {
    throw new Error("O arquivo não contém uma lista de músicas para importar.");
  }
  if (document.songs.length > 2_000) {
    throw new Error("O arquivo excede o limite de 2.000 músicas. Divida o catálogo em arquivos menores.");
  }
  // Field validation and permission checks remain authoritative on the API.
  return document as SongTransferDocument;
}
