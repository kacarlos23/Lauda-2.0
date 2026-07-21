import { AxiosError } from "axios";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { api } from "./api";
import { Artist, MusicalKey, Pagination, Song } from "../types";

type ApiResponse<T> = { success: boolean; data: T };
export type Paginated<T> = { items: T[]; pagination: Pagination };

export type ArtistPayload = { name: string; imageUrl?: string | null };
export type SongPayload = {
  title: string;
  artistId: string;
  composer?: string | null;
  originalKey: MusicalKey;
  content: string;
  comments?: string | null;
  bpm?: number | null;
  cifraUrl?: string | null;
  letraUrl?: string | null;
  audioUrl?: string | null;
  videoUrl?: string | null;
};

export type SongListParams = {
  search?: string;
  ministryId?: string;
  instrumentId?: string;
  withoutMinistry?: boolean;
  withoutInstrument?: boolean;
};

export type CifraClubSearchResult = {
  title: string;
  artist: string;
  url: string;
  originalKey?: string | null;
};

export type CifraClubSearchParams = {
  artist?: string;
  title?: string;
};

export type CifraClubImportResult = {
  title: string;
  artist: string;
  originalKey: MusicalKey;
  cifraUrl: string;
  content: string;
  source: "download" | "page-fallback";
};

function apiError(error: unknown, fallback: string): never {
  if (error instanceof AxiosError || (typeof error === "object" && error !== null && "response" in error)) {
    const axiosError = error as AxiosError<{ error?: string; message?: string }>;
    if (axiosError.code === "ECONNABORTED") {
      throw new Error("A conexão demorou demais para responder. Tente novamente em alguns segundos.");
    }
    if (!axiosError.response) {
      throw new Error("Não foi possível conectar ao backend. Verifique se o servidor está ligado.");
    }
    const data = axiosError.response.data;
    throw new Error(data?.error ?? data?.message ?? fallback);
  }
  if (error instanceof Error) throw error;
  throw new Error(fallback);
}

export const musicService = {
  async listArtists(search = "", page = 1, limit = 20): Promise<Paginated<Artist>> {
    try {
      const response = await api.get<ApiResponse<Paginated<Artist>>>("/artists", { params: { search, page, limit } });
      return response.data.data;
    } catch (error) { apiError(error, "Não foi possível carregar os artistas."); }
  },

  async createArtist(payload: ArtistPayload): Promise<Artist> {
    try {
      const response = await api.post<ApiResponse<Artist>>("/artists", payload);
      return response.data.data;
    } catch (error) { apiError(error, "Não foi possível criar o artista."); }
  },

  async updateArtist(id: string, payload: Partial<ArtistPayload>): Promise<Artist> {
    try {
      const response = await api.patch<ApiResponse<Artist>>(`/artists/${id}`, payload);
      return response.data.data;
    } catch (error) { apiError(error, "Não foi possível atualizar o artista."); }
  },

  async listSongs(search = "", page = 1, limit = 20, filters?: SongListParams): Promise<Paginated<Song>> {
    try {
      const response = await api.get<ApiResponse<Paginated<Song>>>("/songs", { params: { ...filters, search, page, limit } });
      return response.data.data;
    } catch (error) { apiError(error, "Não foi possível carregar as músicas."); }
  },

  async getSong(id: string): Promise<Song> {
    try {
      const response = await api.get<ApiResponse<Song>>(`/songs/${id}`);
      return response.data.data;
    } catch (error) { apiError(error, "Não foi possível carregar a música."); }
  },

  async createSong(payload: SongPayload): Promise<Song> {
    try {
      const response = await api.post<ApiResponse<Song>>("/songs", payload);
      return response.data.data;
    } catch (error) { apiError(error, "Não foi possível criar a música."); }
  },

  async updateSong(id: string, payload: Partial<SongPayload>): Promise<Song> {
    try {
      const response = await api.patch<ApiResponse<Song>>(`/songs/${id}`, payload);
      return response.data.data;
    } catch (error) { apiError(error, "Não foi possível atualizar a música."); }
  },

  async deleteSong(id: string): Promise<void> {
    try {
      await api.delete(`/songs/${id}`);
    } catch (error) { apiError(error, "Não foi possível excluir a música."); }
  },

  async searchCifraClub({ artist, title }: CifraClubSearchParams): Promise<CifraClubSearchResult[]> {
    try {
      const response = await api.get<ApiResponse<{ items: CifraClubSearchResult[] }>>("/songs/cifra-club/search", {
        params: {
          ...(artist?.trim() ? { artist: artist.trim() } : {}),
          ...(title?.trim() ? { title: title.trim() } : {}),
        },
        timeout: 90000,
      });
      return response.data.data.items;
    } catch (error) { apiError(error, "Não foi possível buscar no Cifra Club. Verifique a conexão com o backend e tente novamente."); }
  },

  async importCifraClub(url: string): Promise<CifraClubImportResult> {
    try {
      const response = await api.post<ApiResponse<CifraClubImportResult>>("/songs/cifra-club/import", { url }, { timeout: 45000 });
      return response.data.data;
    } catch (error) { apiError(error, "Não foi possível importar a cifra do Cifra Club. Verifique a conexão com o backend e tente novamente."); }
  },

  async exportSongs(songIds: string[], filename: string, transpositions?: Record<string, number>): Promise<void> {
    try {
      const response = await api.post<ArrayBuffer>("/songs/export", { songIds, ...(transpositions ? { transpositions } : {}) }, { responseType: "arraybuffer" });
      const bytes = new Uint8Array(response.data);
      if (Platform.OS === "web") {
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
        return;
      }

      const file = new File(Paths.cache, filename);
      file.create({ overwrite: true });
      file.write(bytes);
      if (!await Sharing.isAvailableAsync()) throw new Error("Compartilhamento não disponível neste dispositivo.");
      await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Exportar cifras" });
    } catch (error) { apiError(error, "Não foi possível exportar as cifras."); }
  },
};
