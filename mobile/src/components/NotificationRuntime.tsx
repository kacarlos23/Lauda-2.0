import React, { useEffect } from "react";
import { AppState } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../store/authStore";
import { useNotificationStore } from "../store/notificationStore";
import { addPushResponseListener, addPushTokenRotationListener } from "../services/pushNotificationService";
import { nav } from "../navigation/routes";

function scheduleHref(scheduleId?: string, date?: string) {
  return {
    pathname: nav.schedules,
    params: {
      ...(scheduleId ? { scheduleId } : {}),
      ...(date ? { date: date.slice(0, 10) } : {}),
    },
  } as any;
}

export function NotificationRuntime() {
  const router = useRouter();
  const userId = useAuthStore((state) => state.user?.id);
  const tenantId = useAuthStore((state) => state.user?.tenantId);
  const connect = useNotificationStore((state) => state.connect);
  const disconnect = useNotificationStore((state) => state.disconnect);
  const reset = useNotificationStore((state) => state.reset);
  const load = useNotificationStore((state) => state.load);

  useEffect(() => {
    if (!userId || !tenantId) {
      reset();
      return;
    }
    void load();
    void connect();
    return () => disconnect();
  }, [connect, disconnect, load, reset, tenantId, userId]);

  useEffect(() => {
    const appState = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        disconnect();
        return;
      }
      if (!userId || !tenantId) return;
      void load();
      void connect();
    });
    return () => appState.remove();
  }, [connect, disconnect, load, tenantId, userId]);

  useEffect(() => {
    const subscription = addPushResponseListener((data) => {
      if (String(data.resourceType ?? "").toLowerCase() === "schedule" || data.scheduleId) {
        router.push(scheduleHref(String(data.scheduleId ?? data.resourceId ?? "") || undefined, typeof data.date === "string" ? data.date : undefined));
      }
    });
    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    const subscription = addPushTokenRotationListener();
    return () => subscription.remove();
  }, []);

  return null;
}
