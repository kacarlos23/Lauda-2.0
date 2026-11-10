import {
  songTransferCommitSchema,
  songTransferDocumentSchema,
  songTransferExportSchema,
  songTransferPreviewSchema,
} from "../../validators/songTransfer.schema";

const document = {
  format: "lauda.music-catalog" as const,
  version: 1 as const,
  songs: [{
    title: "Cristo Venceu",
    artist: "JMM",
    originalKey: "A" as const,
    content: "[Intro]\nA D E",
    cifraUrl: "https://www.cifraclub.com.br/jmm/cristo-venceu/",
  }],
};

describe("songTransfer schemas", () => {
  it("limpa cifras do catálogo antes da revisão e rejeita conteúdo apenas invisível", () => {
    const parsed = songTransferDocumentSchema.parse({ ...document, songs: [{ ...document.songs[0], content: "\u200BG\tC\nTexto editado" }] });
    expect(parsed.songs[0].content).toBe("G       C\nTexto editado");
    expect(() => songTransferDocumentSchema.parse({ ...document, songs: [{ ...document.songs[0], content: "\uFEFF\u200B" }] })).toThrow("texto visível");
  });
  it("rejeita campos que não fazem parte do catálogo portátil", () => {
    expect(songTransferDocumentSchema.parse(document)).toEqual(document);
    expect(() => songTransferDocumentSchema.parse({
      ...document,
      songs: [{ ...document.songs[0], privateNote: "não deve atravessar ministérios" }],
    })).toThrow();
  });

  it("aceita catálogo parcial e valida a escolha de campos e de músicas existentes", () => {
    const partial = songTransferDocumentSchema.parse({
      format: "lauda.music-catalog",
      version: 1,
      songs: [{ title: "Já existe", artist: "JMM", tags: ["Natal"], bpm: 96, comments: "Olá" }],
    });
    expect(partial.songs[0]).toMatchObject({ tags: ["Natal"], bpm: 96, comments: "Olá" });
    expect(partial.songs[0].originalKey).toBeUndefined();
    const ministryId = "7d5748e1-3a21-4a3f-b9a6-812983343a77";
    expect(songTransferExportSchema.parse({ ministryId, fields: ["tags"] }).fields).toEqual(["tags"]);
    expect(songTransferPreviewSchema.parse({ ministryId, document, existing: "skip" }).existing).toBe("skip");
    expect(() => songTransferExportSchema.parse({ ministryId, fields: [] })).toThrow();
    expect(() => songTransferPreviewSchema.parse({ ministryId, document, existing: "merge" })).toThrow();
  });

  it("aceita temas opcionais e mantém arquivos sem o campo", () => {
    expect(songTransferDocumentSchema.parse(document).songs[0].tags).toBeUndefined();
    const parsed = songTransferDocumentSchema.parse({
      ...document,
      songs: [{ ...document.songs[0], tags: [" Adoração ", "adoração", "Natal"] }],
    });
    expect(parsed.songs[0].tags).toEqual(["Adoração", "Natal"]);
    expect(() => songTransferDocumentSchema.parse({
      ...document,
      songs: [{ ...document.songs[0], tags: [""] }],
    })).toThrow();
    expect(() => songTransferDocumentSchema.parse({
      ...document,
      songs: [{ ...document.songs[0], tags: ["tema, com vírgula"] }],
    })).toThrow();
  });

  it("aceita link ausente e rejeita tom ou link inválidos", () => {
    expect(songTransferDocumentSchema.parse({
      ...document,
      songs: [{ ...document.songs[0], cifraUrl: undefined }],
    }).songs[0].cifraUrl).toBeUndefined();
    expect(() => songTransferDocumentSchema.parse({
      ...document,
      songs: [{ ...document.songs[0], originalKey: "H" }],
    })).toThrow();
    expect(() => songTransferDocumentSchema.parse({
      ...document,
      songs: [{ ...document.songs[0], cifraUrl: "javascript:alert(1)" }],
    })).toThrow();
  });

  it("exige ministério na revisão e hash SHA-256 na confirmação", () => {
    const ministryId = "7d5748e1-3a21-4a3f-b9a6-812983343a77";
    expect(songTransferPreviewSchema.parse({ ministryId, document }).ministryId).toBe(ministryId);
    expect(() => songTransferCommitSchema.parse({ ministryId, document, documentHash: "curto" })).toThrow();
    expect(songTransferCommitSchema.parse({ ministryId, document, documentHash: "a".repeat(64) }).documentHash).toHaveLength(64);
  });
});

