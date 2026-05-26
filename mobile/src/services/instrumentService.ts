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

function handleApiError(error: unknown): never {
  if (error instanceof AxiosError || (typeof error === "object" && error !== null && "response" in error)) {
    const response = (error as { response?: { data?: { error?: string; message?: string } } }).response;
    const data = response?.data;
    throw new Error(data?.error ?? data?.message ?? "Não foi possível processar instrumentos.");
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
