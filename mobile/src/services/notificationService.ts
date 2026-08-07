import { AxiosError } from "axios";
import { api } from "./api";
import { AppNotification } from "../types";

type ApiResponse<T> = { success: boolean; data: T };

export type NotificationPage = {
  items: AppNotification[];
  unreadCount: number;
  nextCursor: string | null;
};

function handleError(error: unknown): never {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { error?: string; message?: string } | undefined;
    throw new Error(data?.error ?? data?.message ?? "Não foi possível processar notificações.");
  }
  throw error instanceof Error ? error : new Error("Não foi possível processar notificações.");
}

export const notificationService = {
  async list(params?: { cursor?: string; unreadOnly?: boolean; limit?: number }): Promise<NotificationPage> {
    try {
      const response = await api.get<ApiResponse<NotificationPage>>("/notifications", { params });
      const page = response.data.data as NotificationPage | undefined;
      return {
        items: Array.isArray(page?.items) ? page.items : [],
        unreadCount: Number.isFinite(page?.unreadCount) ? page!.unreadCount : 0,
        nextCursor: typeof page?.nextCursor === "string" ? page.nextCursor : null,
      };
    } catch (error) {
      handleError(error);
    }
  },

  async markRead(id: string): Promise<AppNotification> {
    try {
      const response = await api.patch<ApiResponse<AppNotification>>(`/notifications/${id}/read`);
      return response.data.data;
    } catch (error) {
      handleError(error);
    }
  },

  async markAllRead(): Promise<{ updated: number }> {
    try {
      const response = await api.post<ApiResponse<{ updated: number }>>("/notifications/read-all");
      return response.data.data;
    } catch (error) {
      handleError(error);
    }
  },

  async issueRealtimeTicket(): Promise<string> {
    try {
      const response = await api.post<ApiResponse<{ ticket: string }>>("/notifications/realtime-ticket");
      const ticket = response.data.data?.ticket;
      if (!ticket) throw new Error("Ticket de tempo real não foi emitido.");
      return ticket;
    } catch (error) {
      handleError(error);
    }
  },

  async registerDevice(payload: { expoPushToken: string; platform: "ANDROID" | "IOS"; appVersion?: string }) {
    try {
      const response = await api.post<ApiResponse<{ id: string }>>("/notifications/devices", payload);
      return response.data.data;
    } catch (error) {
      handleError(error);
    }
  },

  async removeDevice(id: string) {
    try {
      await api.delete(`/notifications/devices/${id}`);
    } catch (error) {
      handleError(error);
    }
  },
};
