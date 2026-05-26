import { AxiosError } from "axios";
import { api } from "./api";
import { Instrument } from "../types";

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export type UpdateMemberInstrumentsResponse = {
  id: string;
  instruments: Instrument[];
};

export type CreateInstrumentPayload = {
  name: string;
  colorHex?: string | null;
};

export type UpdateInstrumentPayload = {
  name?: string;
  colorHex?: string | null;
};

function handleApiError(error: unknown): never {
  if (error instanceof AxiosError || (typeof error === "object" && error !== null && "response" in error)) {
    const response = (error as { response?: { data?: { error?: string; message?: string } } }).response;
    const data = response?.data;
    throw new Error(data?.error ?? data?.message ?? "Nao foi possivel processar instrumentos.");
  }

  if (error instanceof Error) {
    throw error;
  }

  throw new Error("Erro de rede ao processar instrumentos.");
}

export const instrumentService = {
  async getInstruments(): Promise<Instrument[]> {
    try {
      const response = await api.get<ApiResponse<Instrument[]>>("/instruments");
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async createInstrument(payload: CreateInstrumentPayload): Promise<Instrument> {
    try {
      const response = await api.post<ApiResponse<Instrument>>("/instruments", payload);
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async updateInstrument(id: string, payload: UpdateInstrumentPayload): Promise<Instrument> {
    try {
      const response = await api.patch<ApiResponse<Instrument>>(`/instruments/${id}`, payload);
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async deleteInstrument(id: string): Promise<Instrument> {
    try {
      const response = await api.delete<ApiResponse<Instrument>>(`/instruments/${id}`);
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async updateMemberInstruments(memberId: string, instrumentIds: string[]): Promise<UpdateMemberInstrumentsResponse> {
    try {
      const response = await api.patch<ApiResponse<UpdateMemberInstrumentsResponse>>(`/members/${memberId}/instruments`, {
        instrumentIds,
      });
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async updateMyInstruments(instrumentIds: string[]): Promise<UpdateMemberInstrumentsResponse> {
    try {
      const response = await api.patch<ApiResponse<UpdateMemberInstrumentsResponse>>("/members/me/instruments", {
        instrumentIds,
      });
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },
};
