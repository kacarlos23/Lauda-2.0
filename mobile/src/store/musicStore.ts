import { create } from "zustand";
import { Pagination, Song } from "../types";
import { musicService, SongPayload } from "../services/musicService";

interface MusicState {
  songs: Song[];
  currentSong: Song | null;
  pagination: Pagination;
  loading: boolean;
  detailLoading: boolean;
  saving: boolean;
  error: string | null;
  detailError: string | null;
  requestedSongId: string | null;
  requestedListKey: string | null;
  listMutationVersion: number;
  loadSongs: (search?: string, page?: number) => Promise<void>;
  loadSong: (id: string) => Promise<void>;
  primeSong: (song: Song) => void;
  createSong: (payload: SongPayload) => Promise<Song>;
  updateSong: (id: string, payload: Partial<SongPayload>) => Promise<Song>;
  clearError: () => void;
}

const message = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

function sortSongs(songs: Song[]): Song[] {
  return [...songs].sort((a, b) => a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" }));
}

function upsertSong(songs: Song[], song: Song): { songs: Song[]; inserted: boolean } {
  const index = songs.findIndex((item) => item.id === song.id);
  if (index < 0) return { songs: sortSongs([...songs, song]), inserted: true };

  const next = [...songs];
  next[index] = song;
  return { songs: sortSongs(next), inserted: false };
}

function incrementPaginationTotal(pagination: Pagination): Pagination {
  const total = pagination.total + 1;
  return { ...pagination, total, totalPages: Math.max(1, Math.ceil(total / pagination.limit)) };
}

export const useMusicStore = create<MusicState>((set) => ({
  songs: [],
  currentSong: null,
  pagination: { page: 1, limit: 20, totalPages: 0, total: 0 },
  loading: false,
  detailLoading: false,
  saving: false,
  error: null,
  detailError: null,
  requestedSongId: null,
  requestedListKey: null,
  listMutationVersion: 0,
  clearError: () => set({ error: null }),

  primeSong: (song) => set({
    currentSong: song,
    requestedSongId: song.id,
    detailError: null,
  }),

  loadSongs: async (search = "", page = 1) => {
    const mutationVersion = useMusicStore.getState().listMutationVersion;
    const requestKey = `${search}\u0000${page}\u0000${mutationVersion}`;
    set({ loading: true, error: null, requestedListKey: requestKey });
    try {
      const result = await musicService.listSongs(search, page);
      set((state) => state.requestedListKey === requestKey
        ? { songs: result.items, pagination: result.pagination, loading: false }
        : state);
    } catch (error) {
      set((state) => state.requestedListKey === requestKey
        ? { loading: false, error: message(error, "Não foi possível carregar as músicas.") }
        : state);
    }
  },

  loadSong: async (id) => {
    set((state) => {
      const cachedSong = state.currentSong?.id === id ? state.currentSong : state.songs.find((song) => song.id === id) ?? null;
      return {
        detailLoading: true,
        detailError: null,
        currentSong: cachedSong,
        requestedSongId: id,
      };
    });
    try {
      const song = await musicService.getSong(id);
      set((state) => state.requestedSongId === id
        ? {
          currentSong: song,
          detailLoading: false,
          songs: state.songs.map((item) => item.id === id ? song : item),
        }
        : state);
    } catch (error) {
      set((state) => state.requestedSongId === id
        ? { detailLoading: false, detailError: message(error, "Não foi possível carregar a música.") }
        : state);
    }
  },

  createSong: async (payload) => {
    set({ saving: true, error: null });
    try {
      const song = await musicService.createSong(payload);
      set((state) => {
        const result = upsertSong(state.songs, song);
        return {
          saving: false,
          loading: false,
          currentSong: song,
          requestedSongId: song.id,
          requestedListKey: null,
          detailLoading: false,
          detailError: null,
          songs: result.songs,
          pagination: result.inserted ? incrementPaginationTotal(state.pagination) : state.pagination,
          listMutationVersion: state.listMutationVersion + 1,
        };
      });
      return song;
    } catch (error) {
      const reason = message(error, "Não foi possível criar a música.");
      set({ saving: false, error: reason });
      throw new Error(reason);
    }
  },

  updateSong: async (id, payload) => {
    set({ saving: true, error: null });
    try {
      const song = await musicService.updateSong(id, payload);
      set((state) => {
        const result = upsertSong(state.songs, song);
        return {
          saving: false,
          loading: false,
          currentSong: song,
          requestedSongId: song.id,
          requestedListKey: null,
          detailLoading: false,
          detailError: null,
          songs: result.songs,
          pagination: result.inserted ? incrementPaginationTotal(state.pagination) : state.pagination,
          listMutationVersion: state.listMutationVersion + 1,
        };
      });
      return song;
    } catch (error) {
      const reason = message(error, "Não foi possível atualizar a música.");
      set({ saving: false, error: reason });
      throw new Error(reason);
    }
  },
}));
