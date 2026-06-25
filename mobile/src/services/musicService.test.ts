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

    const payload = { title: "Canção", artistId: "a1", composer: null, originalKey: "C" as const, content: "[C]Letra", bpm: 90 };
    mockedApi.post.mockResolvedValueOnce({ data: { data: { id: "s1", ...payload } } });
    await musicService.createSong(payload);
    expect(mockedApi.post).toHaveBeenLastCalledWith("/songs", payload);
  });

  it("converte erro da API em mensagem de domínio", async () => {
    mockedApi.get.mockRejectedValueOnce({ response: { data: { error: "Música não encontrada" } } });
    await expect(musicService.getSong("missing")).rejects.toThrow("Música não encontrada");
  });
});
