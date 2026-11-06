import { parseSongTransferDocument } from "./songTransfer";

const document = {
  format: "lauda.music-catalog", version: 1,
  songs: [{ title: "Canção", artist: "Artista", originalKey: "Am", content: "Am\nLouvor e adoração", cifraUrl: null }],
};

describe("parseSongTransferDocument", () => {
  it.each(["", "\uFEFF"])("preserva acentos, tom e cifra com prefixo %j", (prefix) => {
    expect(parseSongTransferDocument(prefix + JSON.stringify(document))).toEqual(document);
  });
  it("rejeita JSON malformado", () => {
    expect(() => parseSongTransferDocument("{invalid")).toThrow(SyntaxError);
  });
  it.each([null, [], 1, {}, { songs: [] }, { ...document, format: "outro" }])("explica o formato esperado para %j", (value) => {
    expect(() => parseSongTransferDocument(JSON.stringify(value))).toThrow(/exportado pelo Lauda/);
  });
  it("rejeita versões incompatíveis", () => {
    expect(() => parseSongTransferDocument(JSON.stringify({ ...document, version: 2 }))).toThrow(/versão/);
  });
  it("recusa catálogos que excedem o limite antes de enviar à API", () => {
    expect(() => parseSongTransferDocument(JSON.stringify({ ...document, songs: Array(2001).fill(document.songs[0]) }))).toThrow(/2.000 músicas/);
  });
  it.each([undefined, [], null, {}])("rejeita lista de músicas ausente ou inválida: %j", (songs) => {
    expect(() => parseSongTransferDocument(JSON.stringify({ ...document, songs }))).toThrow(/lista de músicas/);
  });
});
