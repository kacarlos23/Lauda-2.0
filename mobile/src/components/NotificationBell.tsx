import React, { useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Bell, CheckCheck, ChevronRight, X } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useNotificationStore } from "../store/notificationStore";
import { enablePushNotifications } from "../services/pushNotificationService";
import { colors, fontSizes, fontWeights, iconSizes, lineHeights, overlays, radii, shadow, spacing } from "../theme";
import { nav } from "../navigation/routes";
import { AppNotification } from "../types";

const formatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function NotificationBell() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [enablingPush, setEnablingPush] = useState(false);
  const { notifications, unreadCount, nextCursor, loading, error, connectionState, load, markRead, markAllRead } = useNotificationStore();

  const openNotification = async (notification: AppNotification) => {
    await markRead(notification.id);
    setOpen(false);
    if (notification.resourceType.toLowerCase() === "schedule") {
      router.push({
        pathname: nav.schedules,
        params: { scheduleId: notification.resourceId, date: notification.payload.date?.slice(0, 10) },
      } as any);
    }
  };

  const activatePush = async () => {
    try {
      setEnablingPush(true);
      await enablePushNotifications();
      Alert.alert("Notificações ativadas", "Este dispositivo receberá avisos genéricos sobre novas atualizações.");
    } catch (reason) {
      Alert.alert("Não foi possível ativar", reason instanceof Error ? reason.message : "Tente novamente.");
    } finally {
      setEnablingPush(false);
    }
  };

  return (
    <>
      <TouchableOpacity style={styles.bellButton} onPress={() => { setOpen(true); void load(); }} accessibilityRole="button" accessibilityLabel={`Notificações, ${unreadCount} não lidas`}>
        <Bell color={colors.primaryDark} size={iconSizes.s22} />
        {unreadCount ? <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text></View> : null}
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <TouchableOpacity style={styles.dismissArea} onPress={() => setOpen(false)} accessibilityLabel="Fechar notificações" />
          <View style={[styles.panel, width < 600 && styles.panelMobile]}>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Notificações</Text>
                <Text style={styles.connection}>{connectionState === "connected" ? "Atualizações em tempo real" : "Histórico sincronizado"}</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setOpen(false)} accessibilityLabel="Fechar"><X color={colors.ink} size={iconSizes.s22} /></TouchableOpacity>
            </View>
            <View style={styles.toolbar}>
              <TouchableOpacity style={styles.readAll} onPress={() => void markAllRead()} disabled={!unreadCount}>
                <CheckCheck color={unreadCount ? colors.primary : colors.muted} size={iconSizes.s18} />
                <Text style={[styles.readAllText, !unreadCount && styles.disabledText]}>Marcar todas como lidas</Text>
              </TouchableOpacity>
            </View>
            {Platform.OS !== "web" ? (
              <View style={styles.pushExplainer}>
                <Text style={styles.pushText}>Receba um aviso genérico mesmo com o aplicativo fechado. Nenhum dado da escala aparece na tela bloqueada.</Text>
                <TouchableOpacity style={styles.pushButton} onPress={() => void activatePush()} disabled={enablingPush}>
                  {enablingPush ? <ActivityIndicator color={colors.inverse} size="small" /> : <Text style={styles.pushButtonText}>Ativar push</Text>}
                </TouchableOpacity>
              </View>
            ) : null}
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {notifications.map((notification) => (
                <TouchableOpacity key={notification.id} style={[styles.item, !notification.readAt && styles.itemUnread]} onPress={() => void openNotification(notification)}>
                  <View style={[styles.dot, notification.readAt && styles.dotRead]} />
                  <View style={styles.itemCopy}>
                    <Text style={styles.itemTitle}>{notification.title}</Text>
                    <Text style={styles.itemBody}>{notification.body}</Text>
                    <Text style={styles.itemDate}>{formatter.format(new Date(notification.createdAt))}</Text>
                  </View>
                  <ChevronRight color={colors.muted} size={iconSizes.s18} />
                </TouchableOpacity>
              ))}
              {!loading && !notifications.length ? <Text style={styles.empty}>Você ainda não recebeu notificações.</Text> : null}
              {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
              {nextCursor && !loading ? <TouchableOpacity style={styles.moreButton} onPress={() => void load({ append: true })}><Text style={styles.moreText}>Carregar anteriores</Text></TouchableOpacity> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", position: "relative" },
  badge: { position: "absolute", right: 1, top: 1, minWidth: 20, height: 20, paddingHorizontal: 4, borderRadius: 10, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.surface },
  badgeText: { color: colors.inverse, fontSize: fontSizes.s9, fontWeight: fontWeights.bold },
  backdrop: { flex: 1, flexDirection: "row", justifyContent: "flex-end", backgroundColor: overlays.modal },
  dismissArea: { flex: 1 },
  panel: { width: 430, height: "100%", backgroundColor: colors.surface, ...shadow },
  panelMobile: { width: "100%" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  title: { color: colors.ink, fontSize: fontSizes.s20, fontWeight: fontWeights.bold },
  connection: { color: colors.muted, fontSize: fontSizes.s12, marginTop: 2 },
  closeButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  toolbar: { alignItems: "flex-end", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  readAll: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  readAllText: { color: colors.primary, fontSize: fontSizes.s14, fontWeight: fontWeights.semibold },
  disabledText: { color: colors.muted },
  pushExplainer: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, borderRadius: radii.md, padding: spacing.md, backgroundColor: colors.primarySoft, gap: spacing.sm },
  pushText: { color: colors.text, fontSize: fontSizes.s12, lineHeight: lineHeights.h18 },
  pushButton: { alignSelf: "flex-start", minHeight: 36, justifyContent: "center", borderRadius: radii.sm, backgroundColor: colors.primary, paddingHorizontal: spacing.md },
  pushButtonText: { color: colors.inverse, fontSize: fontSizes.s14, fontWeight: fontWeights.bold },
  list: { flex: 1 },
  listContent: { padding: spacing.md, gap: spacing.sm },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  itemUnread: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftBorder },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  dotRead: { backgroundColor: colors.line },
  itemCopy: { flex: 1 },
  itemTitle: { color: colors.ink, fontSize: fontSizes.s14, fontWeight: fontWeights.bold },
  itemBody: { color: colors.text, fontSize: fontSizes.s12, marginTop: spacing.micro, lineHeight: lineHeights.h18 },
  itemDate: { color: colors.muted, fontSize: fontSizes.s11, marginTop: spacing.xs },
  empty: { color: colors.muted, textAlign: "center", padding: spacing.xl },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, borderRadius: radii.sm, padding: spacing.md, fontSize: fontSizes.s12 },
  loader: { margin: spacing.lg },
  moreButton: { alignItems: "center", padding: spacing.md },
  moreText: { color: colors.primary, fontSize: fontSizes.s14, fontWeight: fontWeights.bold },
});
