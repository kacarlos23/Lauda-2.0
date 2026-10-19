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
  artistId?: string;
  originalKey?: MusicalKey;
  ministryId?: string;
};

export type PortableSong = {
  title: string;
  artist: string;
  originalKey: MusicalKey;
  content: string;
  cifraUrl?: string | null;
};

export type SongTransferDocument = {
  format: "lauda.music-catalog";
  version: 1;
  songs: PortableSong[];
};

export type SongTransferPreviewStatus = "CREATE" | "LINK" | "RESTORE" | "ALREADY_LINKED" | "CONFLICT" | "INVALID";
export type SongTransferPreview = {
  documentHash: string;
  total: number;
  unique: number;
  counts: Record<SongTransferPreviewStatus, number>;
  items: Array<{ index: number; title: string; artist: string; status: SongTransferPreviewStatus; reason?: string; differences?: string[] }>;
};

export type SongTransferResult = {
  created: number;
  linked: number;
  restored: number;
  alreadyLinked: number;
  conflicts: number;
  invalid: number;
  total: number;
  documentHash: string;
};

type ApiErrorPayload = {
  error?: string;
  message?: string;
  code?: string | number;
  details?: { songIds?: string[] };
};

export class SongsUnavailableClientError extends Error {
  readonly songIds: string[];

  constructor(songIds: string[], message = "Uma ou mais músicas selecionadas não estão mais disponíveis") {
    super(message);
    this.songIds = songIds;
    Object.setPrototypeOf(this, SongsUnavailableClientError.prototype);
  }
}

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

function decodeBytes(bytes: Uint8Array): string {
  const encoded = Array.from(bytes, (byte) => `%${byte.toString(16).padStart(2, "0")}`).join("");
  try { return decodeURIComponent(encoded); }
  catch { return Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""); }
}

function parseErrorPayload(value: unknown): ApiErrorPayload | undefined {
  let candidate = value;
  if (candidate instanceof ArrayBuffer) candidate = decodeBytes(new Uint8Array(candidate));
  else if (ArrayBuffer.isView(candidate)) {
    candidate = decodeBytes(new Uint8Array(candidate.buffer, candidate.byteOffset, candidate.byteLength));
  }

  if (typeof candidate === "string") {
    const raw = candidate;
    try { candidate = JSON.parse(raw); }
    catch { return { error: raw }; }
  }
  return typeof candidate === "object" && candidate !== null ? candidate as ApiErrorPayload : undefined;
}

function apiError(error: unknown, fallback: string): never {
  if (error instanceof AxiosError || (typeof error === "object" && error !== null && "response" in error)) {
    const axiosError = error as AxiosError<unknown>;
    if (axiosError.code === "ERR_CANCELED") throw error;
    if (axiosError.code === "ECONNABORTED") {
      throw new Error("A conexão demorou demais para responder. Tente novamente em alguns segundos.");
    }
    if (!axiosError.response) {
      throw new Error("Não foi possível conectar ao backend. Verifique se o servidor está ligado.");
    }
    const data = parseErrorPayload(axiosError.response.data);
    if (axiosError.response.status === 409 && data?.code === "SONGS_UNAVAILABLE") {
      throw new SongsUnavailableClientError(data.details?.songIds ?? [], data.error ?? fallback);
    }
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

  async listSongs(search = "", page = 1, limit = 20, filters?: SongListParams, signal?: AbortSignal): Promise<Paginated<Song>> {
    try {
      const response = await api.get<ApiResponse<Paginated<Song>>>("/songs", {
        params: { ...filters, search, page, limit },
        signal,
      });
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

  async exportSongData(ministryId: string, ministryName: string): Promise<void> {
    try {
      const response = await api.post<SongTransferDocument>("/songs/data-export", { ministryId });
      const content = JSON.stringify(response.data, null, 2);
      const safeMinistry = ministryName.normalize("NFKD").replace(/[^a-zA-Z0-9 -]/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "ministerio";
      const filename = `lauda-musicas-${safeMinistry}-${new Date().toISOString().slice(0, 10)}.json`;
      if (Platform.OS === "web") {
        const blob = new Blob([content], { type: "application/json;charset=utf-8" });
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
      file.write(content);
      if (!await Sharing.isAvailableAsync()) throw new Error("Compartilhamento não disponível neste dispositivo.");
      await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: "Exportar músicas do Lauda" });
    } catch (error) { apiError(error, "Não foi possível exportar os dados das músicas."); }
  },

  async previewSongData(ministryId: string, document: SongTransferDocument): Promise<SongTransferPreview> {
    try {
      const response = await api.post<ApiResponse<SongTransferPreview>>("/songs/data-import/preview", { ministryId, document });
      return response.data.data;
    } catch (error) { apiError(error, "Não foi possível revisar o arquivo de músicas."); }
  },

  async commitSongData(ministryId: string, document: SongTransferDocument, documentHash: string): Promise<SongTransferResult> {
    try {
      const response = await api.post<ApiResponse<SongTransferResult>>("/songs/data-import/commit", { ministryId, document, documentHash });
      return response.data.data;
    } catch (error) { apiError(error, "Não foi possível importar as músicas."); }
  },
};
