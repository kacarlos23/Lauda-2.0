import { Song } from "../types";
import { getSongDetailViewState } from "./songDetailState";

const song: Song = {
  id: "song-1",
  title: "Ele é o Senhor",
  composer: null,
  originalKey: "G",
  content: "Letra",
  bpm: null,
  artistId: "artist-1",
  artist: { id: "artist-1", name: "Cidade Viva Music", imageUrl: null },
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

describe("getSongDetailViewState", () => {
  it("renderiza loading enquanto a música da rota ainda não terminou de carregar", () => {
    expect(getSongDetailViewState({
      routeSongId: "song-1",
      currentSong: null,
      requestedSongId: "song-1",
      detailLoading: true,
      detailError: null,
    })).toEqual({ status: "loading" });
  });

  it("não mostra falso 'não encontrada' antes do request da rota iniciar", () => {
    expect(getSongDetailViewState({
      routeSongId: "song-1",
      currentSong: null,
      requestedSongId: null,
      detailLoading: false,
      detailError: null,
    })).toEqual({ status: "loading" });
  });

  it("renderiza a música quando o detalhe carregado corresponde à rota", () => {
    expect(getSongDetailViewState({
      routeSongId: "song-1",
      currentSong: song,
      requestedSongId: "song-1",
      detailLoading: false,
      detailError: null,
    })).toEqual({ status: "ready", song });
  });

  it("mantém a música em cache visível enquanto atualiza em segundo plano", () => {
    expect(getSongDetailViewState({
      routeSongId: "song-1",
      currentSong: song,
      requestedSongId: "song-1",
      detailLoading: true,
      detailError: null,
    })).toEqual({ status: "ready", song });
  });

  it("só mostra erro depois do request da rota falhar", () => {
    expect(getSongDetailViewState({
      routeSongId: "song-1",
      currentSong: null,
      requestedSongId: "song-1",
      detailLoading: false,
      detailError: "Música não encontrada.",
    })).toEqual({ status: "error", message: "Música não encontrada." });
  });
});
