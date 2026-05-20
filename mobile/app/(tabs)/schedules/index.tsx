import { useCallback, useEffect } from "react";
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
import { CalendarClock, Check, X } from "lucide-react-native";
import { useAuthStore } from "../../../src/store/authStore";
import { useScheduleStore } from "../../../src/store/scheduleStore";
import { MySchedule } from "../../../src/types";
import { colors, radii, screen, shadow, spacing } from "../../../src/theme";
import { formatAssignmentStatus, formatScheduleDate } from "../../../src/utils/scheduleFormat";

export default function SchedulesScreen() {
  const { tenant } = useAuthStore();
  const {
    mySchedules,
    loading,
    refreshing,
    error,
    loadMySchedules,
    refreshMySchedules,
    acceptAssignment,
    declineAssignment,
  } = useScheduleStore();

  useEffect(() => {
    void loadMySchedules();
  }, [loadMySchedules]);

  const handleRefresh = useCallback(async () => {
    await refreshMySchedules();
  }, [refreshMySchedules]);

  if (loading && mySchedules.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["left", "right"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>Carregando escalas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <FlatList
        data={mySchedules}
        keyExtractor={(item) => item.assignmentId}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.church}>Igreja atual: {tenant?.name ?? "Não identificada"}</Text>
            <Text style={styles.title}>Minhas escalas</Text>
            <Text style={styles.subtitle}>Acompanhe suas próximas participações e responda convites pendentes.</Text>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => void loadMySchedules()}>
                  <Text style={styles.retryText}>Tentar novamente</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <CalendarClock color={colors.primary} size={28} strokeWidth={2.4} />
            <Text style={styles.emptyTitle}>Nenhuma escala encontrada</Text>
            <Text style={styles.emptyText}>
              Quando você for incluído em uma escala, ela aparecerá aqui com ministério, função e status.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ScheduleCard
            schedule={item}
            onAccept={() => void acceptAssignment(item.schedule.id, item.assignmentId)}
            onDecline={() => void declineAssignment(item.schedule.id, item.assignmentId)}
          />
        )}
      />
    </SafeAreaView>
  );
}

function ScheduleCard({
  schedule,
  onAccept,
  onDecline,
}: {
  schedule: MySchedule;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const isPending = schedule.status === "PENDING";

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleGroup}>
          <Text style={styles.cardTitle}>{schedule.schedule.title}</Text>
          <Text style={styles.cardDate}>{formatScheduleDate(schedule.schedule.date)}</Text>
        </View>
        <View style={[styles.statusBadge, statusStyle(schedule.status)]}>
          <Text style={[styles.statusText, statusTextStyle(schedule.status)]}>
            {formatAssignmentStatus(schedule.status)}
          </Text>
        </View>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Ministério</Text>
        <Text style={styles.detailValue}>{schedule.schedule.ministry.name}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Função</Text>
        <Text style={styles.detailValue}>{schedule.role}</Text>
      </View>

      {isPending ? (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.acceptButton} onPress={onAccept}>
            <Check color={colors.surface} size={17} strokeWidth={2.8} />
            <Text style={styles.primaryActionText}>Aceitar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.declineButton} onPress={onDecline}>
            <X color={colors.danger} size={17} strokeWidth={2.8} />
            <Text style={styles.secondaryActionText}>Recusar</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function statusStyle(status: MySchedule["status"]) {
  if (status === "ACCEPTED") return styles.acceptedBadge;
  if (status === "DECLINED") return styles.declinedBadge;
  return styles.pendingBadge;
}

function statusTextStyle(status: MySchedule["status"]) {
  if (status === "ACCEPTED") return styles.acceptedText;
  if (status === "DECLINED") return styles.declinedText;
  return styles.pendingText;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xl,
  },
  centerText: { color: colors.muted, fontSize: 15, fontWeight: "700" },
  list: {
    width: "100%",
    maxWidth: screen.listMaxWidth,
    alignSelf: "center",
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: { marginBottom: spacing.lg },
  church: {
    fontSize: 15,
    color: colors.text,
    fontWeight: "800",
    marginBottom: spacing.sm,
  },
  title: { fontSize: 30, fontWeight: "800", color: colors.ink, marginBottom: spacing.xs },
  subtitle: { fontSize: 15, color: colors.muted, lineHeight: 22 },
  errorBox: {
    marginTop: spacing.lg,
    backgroundColor: "#FDECEC",
    borderColor: "#F0B8B8",
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.lg,
    gap: spacing.md,
  },
  errorText: { color: colors.danger, fontSize: 14, fontWeight: "700", lineHeight: 20 },
  retryButton: {
    alignSelf: "flex-start",
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryText: { color: colors.danger, fontSize: 14, fontWeight: "800" },
  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "flex-start",
    gap: spacing.sm,
    ...shadow,
  },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  cardTitleGroup: { flex: 1 },
  cardTitle: { fontSize: 19, fontWeight: "800", color: colors.ink, marginBottom: spacing.xs },
  cardDate: { fontSize: 14, color: colors.muted, fontWeight: "700", lineHeight: 20 },
  statusBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
  },
  pendingBadge: { backgroundColor: "#FFF5E8", borderColor: "#F0D5AA" },
  acceptedBadge: { backgroundColor: colors.primarySoft, borderColor: colors.line },
  declinedBadge: { backgroundColor: "#FDECEC", borderColor: "#F0B8B8" },
  statusText: { fontSize: 12, fontWeight: "800" },
  pendingText: { color: colors.accent },
  acceptedText: { color: colors.primaryDark },
  declinedText: { color: colors.danger },
  detailRow: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
    marginTop: spacing.md,
  },
  detailLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  detailValue: { color: colors.text, fontSize: 15, fontWeight: "700" },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  acceptButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  declineButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  primaryActionText: { color: colors.surface, fontSize: 15, fontWeight: "800" },
  secondaryActionText: { color: colors.danger, fontSize: 15, fontWeight: "800" },
});

