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
const songA = { ...song, id: "a", title: "A" };
const songB = { ...song, id: "b", title: "B" };
const songC = { ...song, id: "c", title: "C" };
const songD = { ...song, id: "d", title: "D" };

describe("musicStore", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedService.listSongs.mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    useMusicStore.setState(initial, true);
  });

  it("carrega lista paginada", async () => {
    mockedService.listSongs.mockResolvedValueOnce({ items: [song], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    await useMusicStore.getState().loadSongs("canção", 1);
    expect(mockedService.listSongs).toHaveBeenCalledWith("canção", 1);
    expect(useMusicStore.getState().songs).toEqual([song]);
    expect(useMusicStore.getState().pagination.total).toBe(1);
    expect(useMusicStore.getState().lastFetchedAt).not.toBeNull();
  });

  it("mantem lista atual durante refresh em background", async () => {
    let resolveList!: (value: { items: Song[]; pagination: { page: number; limit: number; total: number; totalPages: number } }) => void;
    useMusicStore.setState({
      songs: [songA],
      pagination: { page: 1, limit: 20, totalPages: 1, total: 1 },
    });
    mockedService.listSongs.mockReturnValueOnce(new Promise((resolve) => { resolveList = resolve; }));

    const promise = useMusicStore.getState().loadSongs("", 1, { refresh: true });

    expect(useMusicStore.getState().songs).toEqual([songA]);
    expect(useMusicStore.getState().loading).toBe(false);
    expect(useMusicStore.getState().refreshing).toBe(true);

    resolveList({ items: [songB], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    await promise;

    expect(useMusicStore.getState().songs).toEqual([songB]);
    expect(useMusicStore.getState().refreshing).toBe(false);
  });

  it("mantém formulário no chamador ao falhar criação", async () => {
    mockedService.createSong.mockRejectedValueOnce(new Error("Título duplicado"));
    await expect(useMusicStore.getState().createSong({ title: "Canção", artistId: "a1", originalKey: "C", content: "[C]" })).rejects.toThrow("Título duplicado");
    expect(useMusicStore.getState().error).toBe("Título duplicado");
    expect(useMusicStore.getState().saving).toBe(false);
  });

  it("adiciona musica criada sem remover as musicas ja carregadas", async () => {
    useMusicStore.setState({
      songs: [songA, songB, songC],
      pagination: { page: 1, limit: 20, totalPages: 1, total: 3 },
    });
    mockedService.createSong.mockResolvedValueOnce(songD);

    await useMusicStore.getState().createSong({ title: "D", artistId: "a1", originalKey: "C", content: "[C]" });

    expect(useMusicStore.getState().songs.map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
    expect(useMusicStore.getState().pagination.total).toBe(4);
    expect(useMusicStore.getState().currentSong).toEqual(songD);
    expect(useMusicStore.getState().listInvalidationVersion).toBe(1);
    expect(mockedService.listSongs).not.toHaveBeenCalled();
  });

  it("mantem musica criada quando a revalidacao ainda retorna lista antiga", async () => {
    useMusicStore.setState({
      songs: [songA, songB, songC],
      pagination: { page: 1, limit: 20, totalPages: 1, total: 3 },
    });
    mockedService.createSong.mockResolvedValueOnce(songD);
    mockedService.listSongs.mockResolvedValueOnce({
      items: [songA, songB, songC],
      pagination: { page: 1, limit: 20, totalPages: 1, total: 3 },
    });

    await useMusicStore.getState().createSong({ title: "D", artistId: "a1", originalKey: "C", content: "[C]" });
    await useMusicStore.getState().loadSongs("", 1, { refresh: true });

    expect(useMusicStore.getState().songs.map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
    expect(useMusicStore.getState().pagination.total).toBe(4);
  });

  it("nao mistura musicas criadas localmente em paginas posteriores", async () => {
    useMusicStore.setState({
      songs: [songA, songB, songC],
      pagination: { page: 1, limit: 3, totalPages: 2, total: 4 },
    });
    mockedService.createSong.mockResolvedValueOnce(songD);
    mockedService.listSongs.mockResolvedValueOnce({
      items: [{ ...song, id: "e", title: "E" }],
      pagination: { page: 2, limit: 3, totalPages: 2, total: 4 },
    });

    await useMusicStore.getState().createSong({ title: "D", artistId: "a1", originalKey: "C", content: "[C]" });
    await useMusicStore.getState().loadSongs("", 2, { refresh: true });

    expect(useMusicStore.getState().songs.map((item) => item.id)).toEqual(["e"]);
    expect(useMusicStore.getState().pagination).toMatchObject({ page: 2, total: 4, totalPages: 2 });
  });

  it("atualiza detalhe e item da lista", async () => {
    const updated = { ...song, originalKey: "D" as const };
    useMusicStore.setState({ songs: [song], currentSong: song });
    mockedService.updateSong.mockResolvedValueOnce(updated);
    await useMusicStore.getState().updateSong(song.id, { originalKey: "D" });
    expect(useMusicStore.getState().currentSong).toEqual(updated);
    expect(useMusicStore.getState().songs[0].originalKey).toBe("D");
    expect(useMusicStore.getState().listInvalidationVersion).toBe(1);
    expect(mockedService.listSongs).not.toHaveBeenCalled();
  });

  it("edita uma musica sem remover outras musicas da lista", async () => {
    const updatedD = { ...songD, title: "D editada" };
    useMusicStore.setState({
      songs: [songA, songB, songC, songD],
      currentSong: songD,
      pagination: { page: 1, limit: 20, totalPages: 1, total: 4 },
    });
    mockedService.updateSong.mockResolvedValueOnce(updatedD);

    await useMusicStore.getState().updateSong(songD.id, { title: "D editada" });

    expect(useMusicStore.getState().songs.map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
    expect(useMusicStore.getState().songs.find((item) => item.id === "d")?.title).toBe("D editada");
    expect(useMusicStore.getState().currentSong).toEqual(updatedD);
  });

  it("mantem edicao local quando a revalidacao ainda retorna item antigo", async () => {
    const updatedD = { ...songD, title: "D editada" };
    useMusicStore.setState({
      songs: [songA, songB, songC, songD],
      currentSong: songD,
      pagination: { page: 1, limit: 20, totalPages: 1, total: 4 },
    });
    mockedService.updateSong.mockResolvedValueOnce(updatedD);
    mockedService.listSongs.mockResolvedValueOnce({
      items: [songA, songB, songC, songD],
      pagination: { page: 1, limit: 20, totalPages: 1, total: 4 },
    });

    await useMusicStore.getState().updateSong(songD.id, { title: "D editada" });
    await useMusicStore.getState().loadSongs("", 1, { refresh: true });

    expect(useMusicStore.getState().songs.find((item) => item.id === "d")?.title).toBe("D editada");
    expect(useMusicStore.getState().currentSong).toEqual(updatedD);
  });

  it("ignora listagem antiga que retorna depois de uma criacao", async () => {
    let resolveList!: (value: { items: Song[]; pagination: { page: number; limit: number; total: number; totalPages: number } }) => void;
    mockedService.listSongs.mockReturnValueOnce(new Promise((resolve) => { resolveList = resolve; }));
    mockedService.listSongs.mockResolvedValueOnce({
      items: [songA, songB, songC, songD],
      pagination: { page: 1, limit: 20, total: 4, totalPages: 1 },
    });
    mockedService.createSong.mockResolvedValueOnce(songD);
    useMusicStore.setState({
      songs: [songA, songB, songC],
      pagination: { page: 1, limit: 20, totalPages: 1, total: 3 },
    });

    const listPromise = useMusicStore.getState().loadSongs("", 1);
    await useMusicStore.getState().createSong({ title: "D", artistId: "a1", originalKey: "C", content: "[C]" });
    resolveList({ items: [songA, songB, songC], pagination: { page: 1, limit: 20, total: 3, totalPages: 1 } });
    await listPromise;

    expect(useMusicStore.getState().songs.map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
    expect(useMusicStore.getState().loading).toBe(false);
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
