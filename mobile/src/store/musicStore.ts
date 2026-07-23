import { create } from "zustand";
import { Pagination, Song } from "../types";
import { musicService, SongListParams, SongPayload } from "../services/musicService";

interface MusicState {
  songs: Song[];
  currentSong: Song | null;
  pagination: Pagination;
  loading: boolean;
  refreshing: boolean;
  detailLoading: boolean;
  saving: boolean;
  error: string | null;
  detailError: string | null;
  requestedSongId: string | null;
  requestedListKey: string | null;
  currentSearch: string;
  currentPage: number;
  currentFilters: SongListParams;
  lastFetchedAt: number | null;
  listMutationVersion: number;
  listInvalidationVersion: number;
  localMutations: Record<string, Song>;
  loadSongs: (search?: string, page?: number, options?: { refresh?: boolean; filters?: SongListParams }) => Promise<void>;
  loadSong: (id: string) => Promise<void>;
  primeSong: (song: Song) => void;
  createSong: (payload: SongPayload) => Promise<Song>;
  updateSong: (id: string, payload: Partial<SongPayload>) => Promise<Song>;
  deleteSong: (id: string) => Promise<void>;
  clearError: () => void;
}

const message = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
let activeListRequest: AbortController | null = null;

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

function adjustPaginationTotal(pagination: Pagination, delta: number): Pagination {
  if (!delta) return pagination;
  const total = Math.max(0, pagination.total + delta);
  return { ...pagination, total, totalPages: total ? Math.ceil(total / pagination.limit) : 0 };
}

function songMatchesList(song: Song, search: string, filters: SongListParams): boolean {
  const term = search.trim().toLowerCase();
  const matchesSearch = !term || [song.title, song.artist.name, song.composer ?? ""]
    .some((value) => value.toLowerCase().includes(term));
  if (!matchesSearch) return false;
  if (filters.artistId && song.artistId !== filters.artistId) return false;
  if (filters.originalKey && song.originalKey !== filters.originalKey) return false;
  return true;
}

function mergeLocalMutations(
  songs: Song[],
  localMutations: Record<string, Song>,
  search: string,
  filters: SongListParams
): { songs: Song[]; inserted: number } {
  const visibleLocalSongs = Object.values(localMutations).filter((song) => songMatchesList(song, search, filters));
  if (!visibleLocalSongs.length) return { songs, inserted: 0 };

  let inserted = 0;
  const mergedById = new Map(songs.map((song) => [song.id, song]));
  visibleLocalSongs.forEach((song) => {
    if (!mergedById.has(song.id)) inserted += 1;
    mergedById.set(song.id, song);
  });

  return { songs: sortSongs([...mergedById.values()]), inserted };
}

export const useMusicStore = create<MusicState>((set) => ({
  songs: [],
  currentSong: null,
  pagination: { page: 1, limit: 20, totalPages: 0, total: 0 },
  loading: false,
  refreshing: false,
  detailLoading: false,
  saving: false,
  error: null,
  detailError: null,
  requestedSongId: null,
  requestedListKey: null,
  currentSearch: "",
  currentPage: 1,
  currentFilters: {},
  lastFetchedAt: null,
  listMutationVersion: 0,
  listInvalidationVersion: 0,
  localMutations: {},
  clearError: () => set({ error: null }),

  primeSong: (song) => set({
    currentSong: song,
    requestedSongId: song.id,
    detailError: null,
  }),

  loadSongs: async (search = "", page = 1, options) => {
    const mutationVersion = useMusicStore.getState().listMutationVersion;
    const filters = options?.filters ?? {};
    const requestKey = JSON.stringify([
      search.trim(),
      page,
      filters.artistId ?? "",
      filters.originalKey ?? "",
      mutationVersion,
    ]);
    const shouldRefresh = Boolean(options?.refresh) || useMusicStore.getState().songs.length > 0;
    activeListRequest?.abort();
    const requestController = new AbortController();
    activeListRequest = requestController;
    set({
      loading: !shouldRefresh,
      refreshing: shouldRefresh,
      error: null,
      requestedListKey: requestKey,
      currentSearch: search,
      currentPage: page,
      currentFilters: filters,
    });

    try {
      const result = await musicService.listSongs(search, page, 20, filters, requestController.signal);
      set((state) => {
        if (state.requestedListKey !== requestKey) return state;
        const merged = page === 1
          ? mergeLocalMutations(result.items, state.localMutations, search, filters)
          : { songs: result.items, inserted: 0 };
        const total = page === 1 ? Math.max(result.pagination.total, result.pagination.total + merged.inserted) : result.pagination.total;
        const totalPages = page === 1 ? Math.max(result.pagination.totalPages, Math.ceil(total / result.pagination.limit)) : result.pagination.totalPages;
        return {
          songs: merged.songs,
          pagination: { ...result.pagination, total, totalPages },
          loading: false,
          refreshing: false,
          lastFetchedAt: Date.now(),
        };
      });
    } catch (error) {
      if ((error as { code?: string })?.code === "ERR_CANCELED") return;
      set((state) => state.requestedListKey === requestKey
        ? { loading: false, refreshing: false, error: message(error, "Não foi possível carregar as músicas.") }
        : state);
    } finally {
      if (activeListRequest === requestController) activeListRequest = null;
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
        const matchesCurrentList = songMatchesList(song, state.currentSearch, state.currentFilters);
        const result = matchesCurrentList && state.currentPage === 1
          ? upsertSong(state.songs, song)
          : { songs: state.songs, inserted: false };
        return {
          saving: false,
          loading: false,
          currentSong: song,
          requestedSongId: song.id,
          requestedListKey: null,
          detailLoading: false,
          detailError: null,
          songs: result.songs,
          pagination: matchesCurrentList ? incrementPaginationTotal(state.pagination) : state.pagination,
          listMutationVersion: state.listMutationVersion + 1,
          listInvalidationVersion: state.listInvalidationVersion + 1,
          localMutations: { ...state.localMutations, [song.id]: song },
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
        const previous = state.currentSong?.id === id
          ? state.currentSong
          : state.songs.find((item) => item.id === id);
        const matchedBefore = previous ? songMatchesList(previous, state.currentSearch, state.currentFilters) : false;
        const matchesNow = songMatchesList(song, state.currentSearch, state.currentFilters);
        const wasVisible = state.songs.some((item) => item.id === id);
        const songs = matchesNow && (state.currentPage === 1 || wasVisible)
          ? upsertSong(state.songs, song).songs
          : state.songs.filter((item) => item.id !== id);
        const paginationDelta = Number(matchesNow) - Number(matchedBefore);
        return {
          saving: false,
          loading: false,
          currentSong: song,
          requestedSongId: song.id,
          requestedListKey: null,
          detailLoading: false,
          detailError: null,
          songs,
          pagination: adjustPaginationTotal(state.pagination, paginationDelta),
          listMutationVersion: state.listMutationVersion + 1,
          listInvalidationVersion: state.listInvalidationVersion + 1,
          localMutations: { ...state.localMutations, [song.id]: song },
        };
      });
      return song;
    } catch (error) {
      const reason = message(error, "Não foi possível atualizar a música.");
      set({ saving: false, error: reason });
      throw new Error(reason);
    }
  },

  deleteSong: async (id) => {
    set({ saving: true, error: null });
    try {
      await musicService.deleteSong(id);
      set((state) => {
        const deletedSong = state.currentSong?.id === id
          ? state.currentSong
          : state.songs.find((item) => item.id === id);
        const pagination = deletedSong && songMatchesList(deletedSong, state.currentSearch, state.currentFilters)
          ? adjustPaginationTotal(state.pagination, -1)
          : state.pagination;
        const localMutations = { ...state.localMutations };
        delete localMutations[id];
        return {
          saving: false,
          songs: state.songs.filter((song) => song.id !== id),
          currentSong: state.currentSong?.id === id ? null : state.currentSong,
          pagination,
          listMutationVersion: state.listMutationVersion + 1,
          listInvalidationVersion: state.listInvalidationVersion + 1,
          localMutations,
        };
      });
    } catch (error) {
      const reason = message(error, "Não foi possível excluir a música.");
      set({ saving: false, error: reason });
      throw new Error(reason);
    }
  },
}));
