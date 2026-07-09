import { useEffect } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CalendarClock, ClipboardList, UsersRound } from "lucide-react-native";
import { useAuthStore } from "../../src/store/authStore";
import { useScheduleStore } from "../../src/store/scheduleStore";
import { buttonShadow, colors, radii, screen, shadow, spacing } from "../../src/theme";
import {
  countPendingSchedules,
  formatAssignmentStatus,
  formatScheduleDate,
  getNextSchedule,
} from "../../src/utils/scheduleFormat";
import { formatRoleLabel, isGlobalAdmin } from "../../src/utils/permissions";

export default function DashboardScreen() {
  const router = useRouter();
  const { user, tenant } = useAuthStore();
  const { schedules, loading, loadMySchedules } = useScheduleStore();
  const firstName = user?.name?.split(" ")[0] ?? "Usuário";
  const pendingCount = countPendingSchedules(schedules);
  const nextSchedule = getNextSchedule(schedules);

  useEffect(() => {
    void loadMySchedules();
  }, [loadMySchedules]);

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Hoje</Text>
          <Text style={styles.greeting}>Olá, {firstName}</Text>
          <Text style={styles.role}>Veja sua rotina ministerial</Text>
          <Text style={styles.tenant}>
            {isGlobalAdmin(user)
              ? "Acesso global ao sistema"
              : `${formatRoleLabel(user?.role)} · ${tenant?.name ?? "Igreja não identificada"}`}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBubble}>
              <ClipboardList color={colors.primary} size={22} strokeWidth={2.4} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardKicker}>Próxima escala</Text>
              <Text style={styles.cardTitle}>
                {nextSchedule ? nextSchedule.schedule.title : "Sem compromissos agendados"}
              </Text>
            </View>
          </View>

          {loading && schedules.length === 0 ? (
            <ActivityIndicator color={colors.primary} />
          ) : nextSchedule ? (
            <View style={styles.scheduleDetails}>
              <Text style={styles.cardBody}>Ministério: {nextSchedule.schedule.ministry?.name ?? "Não informado"}</Text>
              <Text style={styles.cardBody}>Função: {nextSchedule.role || "Não informada"}</Text>
              <Text style={styles.cardBody}>Data: {formatScheduleDate(nextSchedule.schedule.date)}</Text>
              <Text style={styles.cardBody}>Status: {formatAssignmentStatus(nextSchedule.status)}</Text>
            </View>
          ) : (
            <Text style={styles.cardBody}>
              Quando uma escala for publicada, ela aparecerá aqui com data, horário e ministério.
            </Text>
          )}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push("/schedules" as never)}
            accessibilityRole="button"
            accessibilityLabel="Ver minhas escalas"
          >
            <CalendarClock color={colors.surface} size={16} strokeWidth={2.4} />
            <Text style={styles.primaryButtonText}>Ver minhas escalas</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.metric}>
            <CalendarClock color={colors.primaryDark} size={22} strokeWidth={2.4} />
            <Text style={styles.metricValue}>{pendingCount}</Text>
            <Text style={styles.metricLabel}>Pendentes</Text>
          </View>
          <View style={styles.metric}>
            <UsersRound color={colors.primaryDark} size={22} strokeWidth={2.4} />
            <Text style={styles.metricValue}>{schedules.length}</Text>
            <Text style={styles.metricLabel}>Escalas</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardKicker}>Ministérios</Text>
          <Text style={styles.cardTitle}>Acompanhe suas equipes</Text>
          <Text style={styles.cardBody}>
            Use a aba Ministérios para ver ministérios, descrições e quantidade de membros.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    width: "100%",
    maxWidth: screen.listMaxWidth,
    alignSelf: "center",
    padding: spacing.xl,
    paddingBottom: screen.contentBottomPadding,
  },
  header: { marginBottom: spacing.xl },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  greeting: {
    fontSize: 34,
    fontWeight: "900",
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  role: {
    fontSize: 16,
    color: colors.text,
    fontWeight: "700",
  },
  tenant: {
    marginTop: spacing.sm,
    fontSize: 13,
    color: colors.muted,
    fontWeight: "800",
  },
  summaryRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  metric: {
    flex: 1,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "#BFE7DE",
  },
  metricValue: {
    fontSize: 30,
    fontWeight: "900",
    color: colors.primaryDark,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  metricLabel: { color: colors.text, fontSize: 13, fontWeight: "800", lineHeight: 18 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.lg,
    ...shadow,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeaderText: { flex: 1 },
  cardKicker: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: colors.ink,
    marginBottom: spacing.sm,
    lineHeight: 27,
  },
  cardBody: { fontSize: 15, lineHeight: 22, color: colors.text, fontWeight: "600" },
  scheduleDetails: { gap: spacing.xs, marginBottom: spacing.md },
  primaryButton: {
    alignSelf: "flex-start",
    minHeight: 52,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    ...buttonShadow,
  },
  primaryButtonText: { color: colors.surface, fontSize: 14, fontWeight: "900" },
});
