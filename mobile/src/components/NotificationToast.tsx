import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Bell } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useNotificationStore } from "../store/notificationStore";
import { colors, fontSizes, fontWeights, iconSizes, radii, shadow, spacing } from "../theme";
import { nav } from "../navigation/routes";

export function NotificationToast() {
  const router = useRouter();
  const notification = useNotificationStore((state) => state.latestRealtime);
  const clear = useNotificationStore((state) => state.clearLatestRealtime);
  const [visibleId, setVisibleId] = useState<string | null>(null);

  useEffect(() => {
    if (!notification) return;
    setVisibleId(notification.id);
    const timer = setTimeout(() => {
      setVisibleId(null);
      clear();
    }, 5_000);
    return () => clearTimeout(timer);
  }, [clear, notification]);

  if (!notification || visibleId !== notification.id) return null;
  return (
    <View style={styles.host} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.toast}
        onPress={() => {
          setVisibleId(null);
          clear();
          router.push({ pathname: nav.schedules, params: { scheduleId: notification.resourceId, date: notification.payload.date?.slice(0, 10) } } as any);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Abrir notificação: ${notification.title}`}
      >
        <Bell color={colors.inverse} size={iconSizes.s20} />
        <View style={styles.copy}>
          <Text style={styles.title}>{notification.title}</Text>
          <Text style={styles.body} numberOfLines={2}>{notification.body}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", zIndex: 1000, top: spacing.lg, right: spacing.lg, left: spacing.lg, alignItems: "flex-end" },
  toast: { width: "100%", maxWidth: 420, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surfaceDark, ...shadow },
  copy: { flex: 1 },
  title: { color: colors.inverse, fontSize: fontSizes.s14, fontWeight: fontWeights.bold },
  body: { color: colors.inverseMeta, fontSize: fontSizes.s12, marginTop: 2 },
});
