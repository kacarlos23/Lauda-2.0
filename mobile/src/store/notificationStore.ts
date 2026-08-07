import { create } from "zustand";
import { api } from "../services/api";
import { notificationService } from "../services/notificationService";
import { AppNotification } from "../types";

type ConnectionState = "idle" | "connecting" | "connected" | "reconnecting";

type NotificationState = {
  notifications: AppNotification[];
  unreadCount: number;
  nextCursor: string | null;
  loading: boolean;
  error: string | null;
  connectionState: ConnectionState;
  latestRealtime: AppNotification | null;
  load: (options?: { append?: boolean; unreadOnly?: boolean }) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => void;
  clearLatestRealtime: () => void;
  reset: () => void;
};

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let shouldReconnect = false;

function websocketUrl(ticket: string) {
  const base = String(api.defaults.baseURL ?? "").replace(/\/$/, "");
  return `${base.replace(/^http:/, "ws:").replace(/^https:/, "wss:")}/realtime?ticket=${encodeURIComponent(ticket)}`;
}

function invalidateScheduleData() {
  const { useScheduleStore } = require("./scheduleStore");
  const store = useScheduleStore.getState();
  void store.loadMySchedules({ refresh: true });
  if (store.allSchedules.length) void store.loadSchedules({ refresh: true });
}

function scheduleReconnect(connect: () => Promise<void>) {
  if (!shouldReconnect || reconnectTimer) return;
  const delay = Math.min(30_000, 1_000 * (2 ** Math.min(reconnectAttempt, 5))) + Math.round(Math.random() * 400);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connect();
  }, delay);
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  nextCursor: null,
  loading: false,
  error: null,
  connectionState: "idle",
  latestRealtime: null,

  load: async (options) => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const page = await notificationService.list({
        cursor: options?.append ? get().nextCursor ?? undefined : undefined,
        unreadOnly: options?.unreadOnly,
        limit: 20,
      });
      set((state) => ({
        notifications: options?.append
          ? Array.from(new Map([...state.notifications, ...page.items].map((item) => [item.id, item])).values())
          : page.items,
        unreadCount: page.unreadCount,
        nextCursor: page.nextCursor,
      }));
    } catch (reason) {
      set({ error: reason instanceof Error ? reason.message : "Não foi possível carregar notificações." });
    } finally {
      set({ loading: false });
    }
  },

  markRead: async (id) => {
    const current = get().notifications.find((item) => item.id === id);
    if (!current || current.readAt) return;
    try {
      const updated = await notificationService.markRead(id);
      set((state) => ({
        notifications: state.notifications.map((item) => item.id === id ? updated : item),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (reason) {
      set({ error: reason instanceof Error ? reason.message : "Não foi possível marcar a notificação." });
    }
  },

  markAllRead: async () => {
    try {
      await notificationService.markAllRead();
      const readAt = new Date().toISOString();
      set((state) => ({
        notifications: state.notifications.map((item) => item.readAt ? item : { ...item, readAt }),
        unreadCount: 0,
      }));
    } catch (reason) {
      set({ error: reason instanceof Error ? reason.message : "Não foi possível marcar as notificações." });
    }
  },

  connect: async () => {
    shouldReconnect = true;
    if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
    set({ connectionState: reconnectAttempt ? "reconnecting" : "connecting" });
    try {
      const ticket = await notificationService.issueRealtimeTicket();
      socket = new WebSocket(websocketUrl(ticket));
      socket.onopen = () => {
        reconnectAttempt = 0;
        set({ connectionState: "connected" });
        void get().load();
      };
      socket.onmessage = (event) => {
        try {
          const envelope = JSON.parse(String(event.data)) as { type?: string; data?: AppNotification };
          if (envelope.type !== "notification.created" || !envelope.data) return;
          const notification = envelope.data;
          set((state) => {
            if (state.notifications.some((item) => item.id === notification.id)) return { latestRealtime: notification };
            return {
              notifications: [notification, ...state.notifications],
              unreadCount: state.unreadCount + (notification.readAt ? 0 : 1),
              latestRealtime: notification,
            };
          });
          invalidateScheduleData();
        } catch {
          // Ignore malformed or unsupported envelopes.
        }
      };
      socket.onclose = () => {
        socket = null;
        set({ connectionState: shouldReconnect ? "reconnecting" : "idle" });
        scheduleReconnect(get().connect);
      };
      socket.onerror = () => socket?.close();
    } catch {
      set({ connectionState: "reconnecting" });
      scheduleReconnect(get().connect);
    }
  },

  disconnect: () => {
    shouldReconnect = false;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    socket?.close();
    socket = null;
    reconnectAttempt = 0;
    set({ connectionState: "idle" });
  },

  clearLatestRealtime: () => set({ latestRealtime: null }),
  reset: () => {
    get().disconnect();
    set({ notifications: [], unreadCount: 0, nextCursor: null, latestRealtime: null, loading: false, error: null });
  },
}));
