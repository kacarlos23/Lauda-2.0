import { Song } from "../types";

type SongDetailStateInput = {
  routeSongId?: string | null;
  currentSong: Song | null;
  requestedSongId: string | null;
  detailLoading: boolean;
  detailError: string | null;
};

type SongDetailViewState =
  | { status: "loading" }
  | { status: "ready"; song: Song }
  | { status: "error"; message: string };

export function getSongDetailViewState(input: SongDetailStateInput): SongDetailViewState {
  const routeSongId = input.routeSongId;

  if (!routeSongId) {
    return { status: "error", message: "Música não encontrada." };
  }

  if (input.currentSong?.id === routeSongId) {
    return { status: "ready", song: input.currentSong };
  }

  if (input.detailLoading || input.requestedSongId !== routeSongId) {
    return { status: "loading" };
  }

  return { status: "error", message: input.detailError ?? "Música não encontrada." };
}
