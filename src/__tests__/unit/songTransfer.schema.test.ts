import {
  songTransferCommitSchema,
  songTransferDocumentSchema,
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
  it("aceita somente os cinco campos portáteis da música", () => {
    expect(songTransferDocumentSchema.parse(document)).toEqual(document);
    expect(() => songTransferDocumentSchema.parse({
      ...document,
      songs: [{ ...document.songs[0], comments: "não deve atravessar ministérios" }],
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
