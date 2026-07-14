import { AxiosError } from "axios";
import { api } from "./api";
import { AdminResourceListResponse, GlobalMinistry, GlobalResourceName, GlobalSchedule, GlobalSong, GlobalTenant, GlobalUser, Permission, PermissionEffect, PermissionKey, Role, UserPermissionsResponse } from "../types";

function cleanParams<T extends Record<string, unknown>>(params?: T): Partial<T> | undefined {
  if (!params) return undefined;
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "")
  ) as Partial<T>;
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

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

function apiStatus(error: unknown): number | undefined {
  if (error instanceof AxiosError || (typeof error === "object" && error !== null && "response" in error)) {
    return (error as AxiosError).response?.status;
  }
  return undefined;
}

export const adminService = {
  async getResource<T = Record<string, unknown>>(
    resource: GlobalResourceName,
    filters?: { tenantId?: string; search?: string; page?: number; limit?: number }
  ): Promise<AdminResourceListResponse<T>> {
    try {
      const response = await api.get<{ success: boolean; data: AdminResourceListResponse<T> | T[] }>(`/admin/${resource}`, {
        params: cleanParams(filters),
      });
      const data = response.data.data;
      if (Array.isArray(data)) {
        return {
          items: data,
          pagination: { page: filters?.page ?? 1, limit: filters?.limit ?? data.length, total: data.length, totalPages: 1 },
        };
      }
      return data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async createResource<T = Record<string, unknown>>(resource: GlobalResourceName, payload: Record<string, unknown>): Promise<T> {
    try {
      const response = await api.post<{ success: boolean; data: T }>(`/admin/${resource}`, payload);
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async updateResource<T = Record<string, unknown>>(resource: GlobalResourceName, id: string, payload: Record<string, unknown>): Promise<T> {
    try {
      const response = await api.patch<{ success: boolean; data: T }>(`/admin/${resource}/${id}`, payload);
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async activateResource<T = Record<string, unknown>>(resource: GlobalResourceName, id: string): Promise<T> {
    try {
      const response = await api.post<{ success: boolean; data: T }>(`/admin/${resource}/${id}/activate`);
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async deactivateResource<T = Record<string, unknown>>(resource: GlobalResourceName, id: string): Promise<T> {
    try {
      const response = await api.post<{ success: boolean; data: T }>(`/admin/${resource}/${id}/deactivate`);
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async deleteResource<T = Record<string, unknown>>(resource: GlobalResourceName, id: string): Promise<T> {
    try {
      const response = await api.delete<{ success: boolean; data: T }>(`/admin/${resource}/${id}`, {
        params: { confirm: "permanent" },
      });
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

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

  async updateTenant(tenantId: string, payload: { name?: string; domain?: string | null }): Promise<GlobalTenant> {
    try {
      return await this.updateResource<GlobalTenant>("tenants", tenantId, payload);
    } catch (error) {
      handleApiError(error);
    }
  },

  async updateUser(
    userId: string,
    payload: {
      name?: string;
      email?: string;
      phone?: string | null;
      avatarUrl?: string | null;
      role?: Role;
      tenantId?: string | null;
      password?: string;
    }
  ): Promise<GlobalUser> {
    try {
      return await this.updateResource<GlobalUser>("users", userId, payload);
    } catch (error) {
      handleApiError(error);
    }
  },

  async getGlobalSongs(filters?: { tenantId?: string }): Promise<GlobalSong[]> {
    try {
      const response = await api.get<{ success: boolean; data: GlobalSong[] }>("/admin/songs", { params: filters });
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async updateSong(songId: string, payload: Partial<Pick<GlobalSong, "title" | "composer" | "originalKey" | "content" | "bpm" | "cifraUrl" | "letraUrl" | "audioUrl" | "videoUrl" | "artistId">>): Promise<GlobalSong> {
    try {
      return await this.updateResource<GlobalSong>("songs", songId, payload);
    } catch (error) {
      handleApiError(error);
    }
  },

  async getGlobalSchedules(filters?: { tenantId?: string }): Promise<GlobalSchedule[]> {
    try {
      const response = await api.get<{ success: boolean; data: GlobalSchedule[] }>("/admin/schedules", { params: filters });
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async updateSchedule(
    scheduleId: string,
    payload: {
      title?: string;
      date?: string;
      ministryId?: string;
      songIds?: string[];
      assignments?: Array<{ userId: string; role: string; status?: "PENDING" | "ACCEPTED" | "DECLINED" }>;
    }
  ): Promise<GlobalSchedule> {
    try {
      return await this.updateResource<GlobalSchedule>("schedules", scheduleId, payload);
    } catch (error) {
      handleApiError(error);
    }
  },

  async listPermissions(): Promise<Permission[]> {
    try {
      const response = await api.get<{ success: boolean; data: Permission[] }>("/admin/permissions");
      return response.data.data;
    } catch (error) { handleApiError(error); }
  },

  async listUserPermissions(userId: string): Promise<UserPermissionsResponse> {
    try {
      const response = await api.get<{ success: boolean; data: UserPermissionsResponse }>(`/admin/users/${userId}/permissions`, {
      });
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async setUserPermissions(
    userId: string,
    overrides: Array<{ permissionKey: PermissionKey; effect: PermissionEffect }>
  ): Promise<UserPermissionsResponse> {
    try {
      const response = await api.put<{ success: boolean; data: UserPermissionsResponse }>(`/admin/users/${userId}/permissions`, {
        overrides,
      });
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },
};
