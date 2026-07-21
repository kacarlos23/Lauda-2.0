import { AxiosError } from "axios";
import { api } from "./api";
import { ChurchOverview, ChurchSummary } from "../types";

function handleApiError(error: unknown): never {
  if (error instanceof AxiosError || (typeof error === "object" && error !== null && "response" in error)) {
    const response = (error as AxiosError<{ error?: string; message?: string }>).response;
    const message = response?.data?.error || response?.data?.message || "Não foi possível carregar os dados da igreja.";
    throw new Error(message);
  }

  if (error instanceof Error) {
    throw error;
  }

  throw new Error("Erro desconhecido de rede");
}

export const churchService = {
  async getMyChurch(): Promise<ChurchSummary> {
    try {
      const response = await api.get<{ success: boolean; data: ChurchSummary }>("/church/me");
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async updateMyChurch(payload: { name: string; comments?: string | null }): Promise<ChurchSummary> {
    try {
      const response = await api.patch<{ success: boolean; data: ChurchSummary }>("/church/me", payload);
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async getChurchOverview(): Promise<ChurchOverview> {
    try {
      const response = await api.get<{ success: boolean; data: ChurchOverview }>("/church/overview");
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },
};
