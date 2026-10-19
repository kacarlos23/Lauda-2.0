jest.mock("expo-file-system", () => ({ File: jest.fn(), Paths: { cache: "cache" } }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock("react-native", () => ({ Platform: { OS: "web" } }));
jest.mock("./api", () => ({ api: { get: jest.fn(), patch: jest.fn(), post: jest.fn() } }));

import { api } from "./api";
import { musicService } from "./musicService";

const mockedApi = api as jest.Mocked<typeof api>;

describe("musicService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("busca artistas com paginação", async () => {
    const data = { items: [{ id: "a1", name: "Oficina G3" }], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } };
    mockedApi.get.mockResolvedValueOnce({ data: { success: true, data } });
    await expect(musicService.listArtists("oficina", 1, 10)).resolves.toEqual(data);
    expect(mockedApi.get).toHaveBeenCalledWith("/artists", { params: { search: "oficina", page: 1, limit: 10 } });
  });

  it("cria artista e música com os payloads corretos", async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { data: { id: "a1", name: "Artista" } } });
    await musicService.createArtist({ name: "Artista" });
    expect(mockedApi.post).toHaveBeenLastCalledWith("/artists", { name: "Artista" });

    const payload = {
      title: "Canção",
      artistId: "a1",
      composer: null,
      originalKey: "C" as const,
      content: "[C]Letra",
      bpm: 90,
      cifraUrl: "https://example.com/cifra",
      letraUrl: "https://example.com/letra",
      audioUrl: "https://example.com/audio",
      videoUrl: "https://example.com/video",
    };
    mockedApi.post.mockResolvedValueOnce({ data: { data: { id: "s1", ...payload } } });
    await musicService.createSong(payload);
    expect(mockedApi.post).toHaveBeenLastCalledWith("/songs", payload);
  });

  it("atualiza música com links externos", async () => {
    const payload = { cifraUrl: "https://example.com/nova-cifra", letraUrl: null };
    mockedApi.patch.mockResolvedValueOnce({ data: { data: { id: "s1", ...payload } } });

    await musicService.updateSong("s1", payload);

    expect(mockedApi.patch).toHaveBeenLastCalledWith("/songs/s1", payload);
  });

  it("busca e importa cifra do Cifra Club", async () => {
    const items = [{ title: "Autor da Vida", artist: "Aline Barros", url: "https://www.cifraclub.com.br/aline-barros/autor-da-vida/" }];
    mockedApi.get.mockResolvedValueOnce({ data: { data: { items } } });

    await expect(musicService.searchCifraClub({ artist: "Aline Barros", title: "Autor da Vida" })).resolves.toEqual(items);
    expect(mockedApi.get).toHaveBeenLastCalledWith("/songs/cifra-club/search", {
      params: { artist: "Aline Barros", title: "Autor da Vida" },
      timeout: 90000,
    });

    const imported = {
      title: "Autor da Vida",
      artist: "Aline Barros",
      originalKey: "G",
      cifraUrl: items[0].url,
      content: "[Intro] G",
      source: "download",
    };
    mockedApi.post.mockResolvedValueOnce({ data: { data: imported } });

    await expect(musicService.importCifraClub(items[0].url)).resolves.toEqual(imported);
    expect(mockedApi.post).toHaveBeenLastCalledWith("/songs/cifra-club/import", { url: items[0].url }, { timeout: 45000 });
  });

  it("envia filtros de música e sinal de cancelamento", async () => {
    const data = { items: [], pagination: { page: 2, limit: 20, total: 0, totalPages: 0 } };
    const controller = new AbortController();
    mockedApi.get.mockResolvedValueOnce({ data: { success: true, data } });

    await musicService.listSongs("graça", 2, 20, { artistId: "artist-1", originalKey: "G" }, controller.signal);

    expect(mockedApi.get).toHaveBeenCalledWith("/songs", {
      params: { artistId: "artist-1", originalKey: "G", search: "graça", page: 2, limit: 20 },
      signal: controller.signal,
    });
  });

  it("envia somente os filtros preenchidos na busca do Cifra Club", async () => {
    mockedApi.get.mockResolvedValue({ data: { data: { items: [] } } });

    await musicService.searchCifraClub({ artist: " Aline Barros " });
    expect(mockedApi.get).toHaveBeenLastCalledWith("/songs/cifra-club/search", {
      params: { artist: "Aline Barros" },
      timeout: 90000,
    });

    await musicService.searchCifraClub({ title: " Autor da Vida " });
    expect(mockedApi.get).toHaveBeenLastCalledWith("/songs/cifra-club/search", {
      params: { title: "Autor da Vida" },
      timeout: 90000,
    });
  });

  it("exporta PDF com transposição opcional por música", async () => {
    const createObjectURL = jest.fn(() => "blob:url");
    const revokeObjectURL = jest.fn();
    const click = jest.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    Object.assign(globalThis, { document: { createElement: jest.fn(() => ({ click })) } });
    mockedApi.post.mockResolvedValueOnce({ data: new ArrayBuffer(4) });

    await musicService.exportSongs(["s1"], "cifra.pdf", { s1: 2 });

    expect(mockedApi.post).toHaveBeenLastCalledWith("/songs/export", { songIds: ["s1"], transpositions: { s1: 2 } }, { responseType: "arraybuffer" });
    expect(click).toHaveBeenCalled();
  });

  it("revisa, confirma e exporta o catálogo portátil de um ministério", async () => {
    const document = {
      format: "lauda.music-catalog" as const,
      version: 1 as const,
      songs: [{ title: "Cristo Venceu", artist: "JMM", originalKey: "A" as const, content: "A D E", cifraUrl: null }],
    };
    const preview = {
      documentHash: "a".repeat(64), total: 1, unique: 1,
      counts: { CREATE: 1, LINK: 0, RESTORE: 0, ALREADY_LINKED: 0, CONFLICT: 0, INVALID: 0 },
      items: [{ index: 0, title: "Cristo Venceu", artist: "JMM", status: "CREATE" as const }],
    };
    mockedApi.post.mockResolvedValueOnce({ data: { success: true, data: preview } });
    await expect(musicService.previewSongData("ministry-1", document)).resolves.toEqual(preview);
    expect(mockedApi.post).toHaveBeenLastCalledWith("/songs/data-import/preview", { ministryId: "ministry-1", document });

    const committed = { created: 1, linked: 1, restored: 0, alreadyLinked: 0, conflicts: 0, invalid: 0, total: 1, documentHash: preview.documentHash };
    mockedApi.post.mockResolvedValueOnce({ data: { success: true, data: committed } });
    await expect(musicService.commitSongData("ministry-1", document, preview.documentHash)).resolves.toEqual(committed);
    expect(mockedApi.post).toHaveBeenLastCalledWith("/songs/data-import/commit", { ministryId: "ministry-1", document, documentHash: preview.documentHash });

    const createObjectURL = jest.fn(() => "blob:catalog");
    const click = jest.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL: jest.fn() });
    Object.assign(globalThis, { document: { createElement: jest.fn(() => ({ click })) } });
    mockedApi.post.mockResolvedValueOnce({ data: document });
    await musicService.exportSongData("ministry-1", "Louvor da Manhã");
    expect(mockedApi.post).toHaveBeenLastCalledWith("/songs/data-export", { ministryId: "ministry-1" });
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
  });

  it("converte erro da API em mensagem de domínio", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { data: { error: "Música não encontrada" } } });
    await expect(musicService.getSong("missing")).rejects.toThrow("Música não encontrada");
  });

  it("converte indisponibilidade binária da exportação em erro tipado", async () => {
    const body = JSON.stringify({
      success: false,
      error: "Songs unavailable",
      code: "SONGS_UNAVAILABLE",
      details: { songIds: ["song-2"] },
    });
    const bytes = Uint8Array.from(Array.from(body).map((character) => character.charCodeAt(0)));
    mockedApi.post.mockRejectedValueOnce({ response: { status: 409, data: bytes.buffer } });

    await expect(musicService.exportSongs(["song-1", "song-2"], "cifras.pdf"))
      .rejects.toEqual(expect.objectContaining({ songIds: ["song-2"] }));
  });
});
