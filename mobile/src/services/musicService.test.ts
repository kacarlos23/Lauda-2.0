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

    await expect(musicService.searchCifraClub("Aline Barros", "Autor da Vida")).resolves.toEqual(items);
    expect(mockedApi.get).toHaveBeenLastCalledWith("/songs/cifra-club/search", {
      params: { artist: "Aline Barros", title: "Autor da Vida" },
      timeout: 45000,
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

  it("converte erro da API em mensagem de domínio", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { data: { error: "Música não encontrada" } } });
    await expect(musicService.getSong("missing")).rejects.toThrow("Música não encontrada");
  });
});
