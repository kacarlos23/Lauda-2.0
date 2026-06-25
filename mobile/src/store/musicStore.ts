import { create } from "zustand";
import { Song } from "../types";
import { musicService, SongPayload } from "../services/musicService";

interface MusicState {
  songs: Song[];
  currentSong: Song | null;
  pagination: { page: number; totalPages: number; total: number };
  loading: boolean;
  saving: boolean;
  error: string | null;
  requestedSongId: string | null;
  requestedListKey: string | null;
  loadSongs: (search?: string, page?: number) => Promise<void>;
  loadSong: (id: string) => Promise<void>;
  createSong: (payload: SongPayload) => Promise<Song>;
  updateSong: (id: string, payload: Partial<SongPayload>) => Promise<Song>;
  clearError: () => void;
}

const message = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export const useMusicStore = create<MusicState>((set) => ({
  songs: [],
  currentSong: null,
  pagination: { page: 1, totalPages: 0, total: 0 },
  loading: false,
  saving: false,
  error: null,
  requestedSongId: null,
  requestedListKey: null,
  clearError: () => set({ error: null }),

  loadSongs: async (search = "", page = 1) => {
    const requestKey = `${search}\u0000${page}`;
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
    set({ loading: true, error: null, currentSong: null, requestedSongId: id });
    try {
      const song = await musicService.getSong(id);
      set((state) => state.requestedSongId === id ? { currentSong: song, loading: false } : state);
    } catch (error) {
      set((state) => state.requestedSongId === id
        ? { loading: false, error: message(error, "Não foi possível carregar a música.") }
        : state);
    }
  },

  createSong: async (payload) => {
    set({ saving: true, error: null });
    try {
      const song = await musicService.createSong(payload);
      set({ saving: false, currentSong: song, requestedSongId: song.id });
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
      set((state) => ({ saving: false, currentSong: song, requestedSongId: song.id, songs: state.songs.map((item) => item.id === id ? song : item) }));
      return song;
    } catch (error) {
      const reason = message(error, "Não foi possível atualizar a música.");
      set({ saving: false, error: reason });
      throw new Error(reason);
    }
  },
}));
