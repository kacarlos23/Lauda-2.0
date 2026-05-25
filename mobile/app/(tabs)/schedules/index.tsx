import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CalendarClock } from "lucide-react-native";
import { useAuthStore } from "../../../src/store/authStore";
import { useScheduleStore } from "../../../src/store/scheduleStore";
import { ScheduleAssignment } from "../../../src/types";
import { colors, radii, screen, shadow, spacing } from "../../../src/theme";
import { formatAssignmentStatus, formatScheduleDate } from "../../../src/utils/scheduleFormat";

export default function SchedulesScreen() {
  const { tenant } = useAuthStore();
  const { schedules, loading, error, loadMySchedules, updateScheduleStatus } = useScheduleStore();
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    void loadMySchedules();
  }, [loadMySchedules]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMySchedules();
    setRefreshing(false);
  }, [loadMySchedules]);

  const handleStatus = async (item: ScheduleAssignment, status: "ACCEPTED" | "DECLINED") => {
    setUpdatingId(item.id);
    try {
      await updateScheduleStatus(item.scheduleId, item.id, status);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading && schedules.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <FlatList
        data={schedules}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Minhas escalas</Text>
            <Text style={styles.subtitle}>Igreja atual: {tenant?.name ?? "Não identificada"}</Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <CalendarClock color={colors.primary} size={28} strokeWidth={2.3} />
            <Text style={styles.emptyTitle}>Nenhuma escala encontrada</Text>
            <Text style={styles.emptyText}>Quando você for escalado, os compromissos aparecerão aqui.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isPending = item.status === "PENDING";
          const isUpdating = updatingId === item.id;

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.iconCircle}>
                  <CalendarClock color={colors.primaryDark} size={20} strokeWidth={2.4} />
                </View>
                <View style={styles.cardTitleGroup}>
                  <Text style={styles.cardTitle}>{item.schedule.title}</Text>
                  <Text style={styles.cardMeta}>{formatScheduleDate(item.schedule.date)}</Text>
                </View>
                <Text style={styles.status}>{formatAssignmentStatus(item.status)}</Text>
              </View>

              <Text style={styles.detail}>Ministério: {item.schedule.ministry?.name ?? "Não informado"}</Text>
              <Text style={styles.detail}>Função: {item.role || "Não informada"}</Text>

              {isPending ? (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={() => void handleStatus(item, "ACCEPTED")}
                    disabled={isUpdating}
                    accessibilityRole="button"
                    accessibilityLabel={`Aceitar ${item.schedule.title}`}
                  >
                    <Text style={styles.acceptButtonText}>{isUpdating ? "Atualizando..." : "Aceitar"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.declineButton]}
                    onPress={() => void handleStatus(item, "DECLINED")}
                    disabled={isUpdating}
                    accessibilityRole="button"
                    accessibilityLabel={`Recusar ${item.schedule.title}`}
                  >
                    <Text style={styles.declineButtonText}>Recusar</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    width: "100%",
    maxWidth: screen.listMaxWidth,
    alignSelf: "center",
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: { marginBottom: spacing.lg },
  title: { fontSize: 28, fontWeight: "800", color: colors.ink, marginBottom: spacing.xs },
  subtitle: { fontSize: 15, color: colors.muted, fontWeight: "600" },
  errorText: { color: colors.danger, fontSize: 14, fontWeight: "700", marginTop: spacing.sm },
  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitleGroup: { flex: 1 },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: "800", marginBottom: spacing.xs },
  cardMeta: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  status: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    textAlign: "right",
  },
  detail: { color: colors.text, fontSize: 14, lineHeight: 21, fontWeight: "600" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  actionButton: {
    minHeight: 40,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptButton: { backgroundColor: colors.primary },
  declineButton: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.line },
  acceptButtonText: { color: colors.surface, fontSize: 13, fontWeight: "800" },
  declineButtonText: { color: colors.text, fontSize: 13, fontWeight: "800" },
});
