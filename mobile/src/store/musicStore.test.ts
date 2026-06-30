jest.mock("../services/musicService", () => ({
  musicService: {
    listSongs: jest.fn(),
    getSong: jest.fn(),
    createSong: jest.fn(),
    updateSong: jest.fn(),
  },
}));

import { musicService } from "../services/musicService";
import { Song } from "../types";
import { useMusicStore } from "./musicStore";

const mockedService = musicService as jest.Mocked<typeof musicService>;
const initial = useMusicStore.getState();
const song: Song = {
  id: "s1", title: "Canção", composer: null, originalKey: "C", content: "[C]Letra", bpm: 90, artistId: "a1",
  artist: { id: "a1", name: "Artista", imageUrl: null }, createdAt: "2026-01-01", updatedAt: "2026-01-01",
};

describe("musicStore", () => {
  beforeEach(() => { jest.clearAllMocks(); useMusicStore.setState(initial, true); });

  it("carrega lista paginada", async () => {
    mockedService.listSongs.mockResolvedValueOnce({ items: [song], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    await useMusicStore.getState().loadSongs("canção", 1);
    expect(mockedService.listSongs).toHaveBeenCalledWith("canção", 1);
    expect(useMusicStore.getState().songs).toEqual([song]);
    expect(useMusicStore.getState().pagination.total).toBe(1);
  });

  it("mantém formulário no chamador ao falhar criação", async () => {
    mockedService.createSong.mockRejectedValueOnce(new Error("Título duplicado"));
    await expect(useMusicStore.getState().createSong({ title: "Canção", artistId: "a1", originalKey: "C", content: "[C]" })).rejects.toThrow("Título duplicado");
    expect(useMusicStore.getState().error).toBe("Título duplicado");
    expect(useMusicStore.getState().saving).toBe(false);
  });

  it("atualiza detalhe e item da lista", async () => {
    const updated = { ...song, originalKey: "D" as const };
    useMusicStore.setState({ songs: [song], currentSong: song });
    mockedService.updateSong.mockResolvedValueOnce(updated);
    await useMusicStore.getState().updateSong(song.id, { originalKey: "D" });
    expect(useMusicStore.getState().currentSong).toEqual(updated);
    expect(useMusicStore.getState().songs[0].originalKey).toBe("D");
  });

  it("ignora resposta atrasada da música aberta anteriormente", async () => {
    const agnus = { ...song, id: "agnus", title: "Agnus Dei" };
    const casa = { ...song, id: "casa", title: "Casa de Deus" };
    let resolveAgnus!: (value: Song) => void;
    let resolveCasa!: (value: Song) => void;
    mockedService.getSong
      .mockReturnValueOnce(new Promise((resolve) => { resolveAgnus = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveCasa = resolve; }));

    const first = useMusicStore.getState().loadSong(agnus.id);
    const second = useMusicStore.getState().loadSong(casa.id);
    resolveCasa(casa);
    await second;
    resolveAgnus(agnus);
    await first;

    expect(useMusicStore.getState().currentSong).toEqual(casa);
    expect(useMusicStore.getState().requestedSongId).toBe(casa.id);
  });

  it("usa a música da lista como cache imediato enquanto atualiza o detalhe", async () => {
    const stale = { ...song, title: "Título em cache" };
    const fresh = { ...song, title: "Título atualizado", content: "Conteúdo atualizado" };
    let resolveSong!: (value: Song) => void;
    useMusicStore.setState({ songs: [stale] });
    mockedService.getSong.mockReturnValueOnce(new Promise((resolve) => { resolveSong = resolve; }));

    const promise = useMusicStore.getState().loadSong(song.id);

    expect(useMusicStore.getState()).toMatchObject({
      currentSong: stale,
      requestedSongId: song.id,
      detailLoading: true,
      detailError: null,
    });

    resolveSong(fresh);
    await promise;

    expect(useMusicStore.getState().currentSong).toEqual(fresh);
    expect(useMusicStore.getState().songs[0]).toEqual(fresh);
    expect(useMusicStore.getState().detailLoading).toBe(false);
  });

  it("prepara a música clicada para renderização imediata antes da navegação", () => {
    useMusicStore.getState().primeSong(song);

    expect(useMusicStore.getState()).toMatchObject({
      currentSong: song,
      requestedSongId: song.id,
      detailError: null,
    });
  });

  it("mantém loading de detalhe separado para não mostrar falso não encontrada", async () => {
    let resolveSong!: (value: Song) => void;
    mockedService.getSong.mockReturnValueOnce(new Promise((resolve) => { resolveSong = resolve; }));

    const promise = useMusicStore.getState().loadSong(song.id);

    expect(useMusicStore.getState()).toMatchObject({
      currentSong: null,
      requestedSongId: song.id,
      detailLoading: true,
      detailError: null,
    });

    resolveSong(song);
    await promise;

    expect(useMusicStore.getState()).toMatchObject({
      currentSong: song,
      requestedSongId: song.id,
      detailLoading: false,
      detailError: null,
    });
  });

  it("erro de lista não contamina erro de detalhe de música", async () => {
    mockedService.listSongs.mockRejectedValueOnce(new Error("Falha na lista"));
    await useMusicStore.getState().loadSongs("", 1);
    expect(useMusicStore.getState().error).toBe("Falha na lista");
    expect(useMusicStore.getState().detailError).toBeNull();
  });
});
