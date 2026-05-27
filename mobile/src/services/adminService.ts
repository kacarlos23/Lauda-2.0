import { AxiosError } from "axios";
import { api } from "./api";
import { GlobalMinistry, GlobalTenant, GlobalUser } from "../types";

function handleApiError(error: unknown): never {
  if (error instanceof AxiosError || (typeof error === "object" && error !== null && "response" in error)) {
    const response = (error as AxiosError<{ error?: string; message?: string }>).response;
    const message = response?.data?.error || response?.data?.message || "Não foi possível carregar o painel global.";
    throw new Error(message);
  }

  if (error instanceof Error) {
    throw error;
  }

  throw new Error("Erro desconhecido de rede");
}

export const adminService = {
  async getTenants(): Promise<GlobalTenant[]> {
    try {
      const response = await api.get<{ success: boolean; data: GlobalTenant[] }>("/admin/tenants");
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async getTenantDetails(tenantId: string): Promise<GlobalTenant> {
    try {
      const response = await api.get<{ success: boolean; data: GlobalTenant }>(`/admin/tenants/${tenantId}`);
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async getGlobalUsers(filters?: { tenantId?: string }): Promise<GlobalUser[]> {
    try {
      const response = await api.get<{ success: boolean; data: GlobalUser[] }>("/admin/users", {
        params: filters,
      });
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async getGlobalMinistries(): Promise<GlobalMinistry[]> {
    try {
      const response = await api.get<{ success: boolean; data: GlobalMinistry[] }>("/admin/ministries");
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },
};
