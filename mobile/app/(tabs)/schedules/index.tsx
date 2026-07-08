import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CalendarClock, Download, Plus } from "lucide-react-native";
import { scheduleService } from "../../../src/services/scheduleService";
import { useAuthStore } from "../../../src/store/authStore";
import { useScheduleStore } from "../../../src/store/scheduleStore";
import { Schedule, ScheduleAssignment } from "../../../src/types";
import { buttonShadow, colors, radii, screen, shadow, spacing } from "../../../src/theme";
import { formatAssignmentStatus } from "../../../src/utils/scheduleFormat";

const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const monthTitle = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

function canManageSchedules(role?: string | null) {
  return role === "GLOBAL_ADMIN" || role === "TENANT_ADMIN" || role === "MINISTRY_LEADER";
}

function dateKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildCalendarDays(reference: Date) {
  const first = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const last = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
  const days: Date[] = [];
  for (let day = 1; day <= last.getDate(); day += 1) {
    days.push(new Date(reference.getFullYear(), reference.getMonth(), day));
  }
  return { firstPadding: first.getDay(), days };
}

export default function SchedulesScreen() {
  const router = useRouter();
  const { tenant, user } = useAuthStore();
  const { allSchedules, schedules: myAssignments, loading, error, loadSchedules, loadMySchedules, updateScheduleStatus } = useScheduleStore();
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [month, setMonth] = useState(() => new Date());

  useEffect(() => {
    void loadSchedules();
    void loadMySchedules();
  }, [loadSchedules, loadMySchedules]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadSchedules(), loadMySchedules()]);
    setRefreshing(false);
  }, [loadSchedules, loadMySchedules]);

  const handleStatus = async (item: ScheduleAssignment, status: "ACCEPTED" | "DECLINED") => {
    setUpdatingId(item.id);
    try {
      await updateScheduleStatus(item.scheduleId, item.id, status);
      await loadMySchedules();
    } finally {
      setUpdatingId(null);
    }
  };

  const exportReport = async (schedule: Schedule) => {
    setExportingId(schedule.id);
    try {
      const date = new Date(schedule.date).toISOString().slice(0, 10);
      await scheduleService.exportScheduleReport(schedule.id, `Escala - ${schedule.title} - ${date}.pdf`, schedule);
    } catch (reason) {
      Alert.alert("Erro", reason instanceof Error ? reason.message : "Não foi possível gerar o relatório da escala.");
    } finally {
      setExportingId(null);
    }
  };

  const assignmentByScheduleId = useMemo(() => {
    const map = new Map<string, ScheduleAssignment>();
    myAssignments.forEach((assignment) => map.set(assignment.scheduleId, assignment));
    return map;
  }, [myAssignments]);

  const schedulesByDay = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    allSchedules.forEach((schedule) => {
      const key = dateKey(schedule.date);
      map.set(key, [...(map.get(key) ?? []), schedule]);
    });
    return map;
  }, [allSchedules]);

  const selectedSchedules = useMemo(
    () => [...(schedulesByDay.get(selectedDate) ?? [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [schedulesByDay, selectedDate]
  );
  const calendar = useMemo(() => buildCalendarDays(month), [month]);
  const todayKey = dateKey(new Date());

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <FlatList
        data={selectedSchedules}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Escalas</Text>
                <Text style={styles.subtitle}>Igreja atual: {tenant?.name ?? "Não identificada"}</Text>
              </View>
              {canManageSchedules(user?.role) ? (
                <TouchableOpacity style={styles.newButton} onPress={() => router.push("/schedules/new" as never)}>
                  <Plus color={colors.surface} size={18} />
                  <Text style={styles.newButtonText}>Nova Escala</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <View style={styles.calendarCard}>
              <View style={styles.monthRow}>
                <TouchableOpacity onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
                  <Text style={styles.monthNav}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.monthTitle}>{monthTitle.format(month)}</Text>
                <TouchableOpacity onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
                  <Text style={styles.monthNav}>›</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.weekRow}>
                {["D", "S", "T", "Q", "Q", "S", "S"].map((label, index) => <Text key={`${label}-${index}`} style={styles.weekLabel}>{label}</Text>)}
              </View>
              <View style={styles.dayGrid}>
                {Array.from({ length: calendar.firstPadding }).map((_, index) => <View key={`pad-${index}`} style={styles.dayCell} />)}
                {calendar.days.map((day) => {
                  const key = dateKey(day);
                  const hasSchedule = schedulesByDay.has(key);
                  const selected = key === selectedDate;
                  const today = key === todayKey;
                  return (
                    <TouchableOpacity key={key} style={[styles.dayCell, today && styles.todayCell, selected && styles.selectedCell]} onPress={() => setSelectedDate(key)}>
                      <Text style={[styles.dayText, selected && styles.selectedDayText]}>{day.getDate()}</Text>
                      {hasSchedule ? <View style={[styles.dot, selected && styles.selectedDot]} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <Text style={styles.sectionTitle}>Escalas do dia</Text>
            {loading && !allSchedules.length ? <ActivityIndicator color={colors.primary} /> : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <CalendarClock color={colors.primary} size={28} strokeWidth={2.3} />
            <Text style={styles.emptyTitle}>Nenhuma escala neste dia</Text>
            <Text style={styles.emptyText}>Selecione outro dia no calendário ou crie uma nova escala.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const assignment = assignmentByScheduleId.get(item.id);
          const isPending = assignment?.status === "PENDING";
          const isUpdating = updatingId === assignment?.id;
          const isExporting = exportingId === item.id;
          const date = new Date(item.date);
          return (
            <View style={styles.card}>
              <Pressable
                style={({ hovered, pressed }: any) => [
                  styles.cardPressArea,
                  canManageSchedules(user?.role) && styles.cardClickable,
                  hovered && canManageSchedules(user?.role) && styles.cardHover,
                  pressed && canManageSchedules(user?.role) && styles.cardPressed,
                ]}
                onPress={() => { if (canManageSchedules(user?.role)) router.push(`/schedules/${item.id}/edit` as never); }}
                accessibilityRole={canManageSchedules(user?.role) ? "button" : undefined}
                accessibilityLabel={canManageSchedules(user?.role) ? `Editar escala ${item.title}` : undefined}
              >
                <View style={styles.summaryDate}>
                  <Text style={styles.dayNumber}>{date.getDate()}</Text>
                  <Text style={styles.weekday}>{weekday.format(date).replace(".", "")}</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTime}>{time.format(date)}</Text>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.detail}>Ministério: {item.ministry?.name ?? "Não informado"}</Text>
                  {item.songs?.length ? <Text style={styles.detail}>Músicas: {item.songs.map((entry) => entry.song.title).join(", ")}</Text> : null}
                  {item.assignments?.length ? <Text style={styles.detail}>Membros: {item.assignments.map((entry) => entry.user?.name ?? "Membro").join(", ")}</Text> : null}
                  {assignment ? <Text style={styles.status}>Minha atribuição: {assignment.role} · {formatAssignmentStatus(assignment.status)}</Text> : null}
                </View>
              </Pressable>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.reportButton}
                  onPress={() => void exportReport(item)}
                  disabled={isExporting}
                  accessibilityRole="button"
                  accessibilityLabel={`Gerar relatório da escala ${item.title}`}
                >
                  {isExporting ? <ActivityIndicator color={colors.primary} /> : <Download color={colors.primary} size={16} strokeWidth={2.4} />}
                  <Text style={styles.reportButtonText}>{isExporting ? "Gerando..." : "Gerar relatório"}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.cardBodyOffset}>
                {isPending && assignment ? (
                  <View style={styles.actions}>
                    <TouchableOpacity style={[styles.actionButton, styles.acceptButton]} onPress={() => void handleStatus(assignment, "ACCEPTED")} disabled={isUpdating}>
                      <Text style={styles.acceptButtonText}>{isUpdating ? "Atualizando..." : "Aceitar"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, styles.declineButton]} onPress={() => void handleStatus(assignment, "DECLINED")} disabled={isUpdating}>
                      <Text style={styles.declineButtonText}>Recusar</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  list: { width: "100%", maxWidth: screen.listMaxWidth, alignSelf: "center", padding: spacing.xl, paddingBottom: 120 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, marginBottom: spacing.lg },
  title: { fontSize: 30, fontWeight: "900", color: colors.ink, marginBottom: spacing.xs },
  subtitle: { fontSize: 15, color: colors.muted, fontWeight: "700" },
  newButton: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.primary, borderRadius: radii.md, paddingHorizontal: spacing.md, ...buttonShadow },
  newButtonText: { color: colors.surface, fontSize: 13, fontWeight: "900" },
  errorText: { color: colors.danger, fontSize: 14, fontWeight: "700", marginBottom: spacing.sm },
  calendarCard: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, marginBottom: spacing.lg, ...shadow },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  monthTitle: { color: colors.ink, fontSize: 17, fontWeight: "900", textTransform: "capitalize" },
  monthNav: { color: colors.primary, fontSize: 30, fontWeight: "900", paddingHorizontal: spacing.md },
  weekRow: { flexDirection: "row" },
  weekLabel: { flex: 1, textAlign: "center", color: colors.muted, fontSize: 12, fontWeight: "900", marginBottom: spacing.xs },
  dayGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: `${100 / 7}%`, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.md },
  todayCell: { borderWidth: 1, borderColor: colors.primary },
  selectedCell: { backgroundColor: colors.primary },
  dayText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  selectedDayText: { color: colors.surface },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary, marginTop: 3 },
  selectedDot: { backgroundColor: colors.surface },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", marginBottom: spacing.md },
  emptyBox: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.line, alignItems: "center", gap: spacing.sm, ...shadow },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center" },
  card: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.line, ...shadow },
  cardPressArea: { flexDirection: "row", borderRadius: radii.lg },
  cardClickable: { cursor: "pointer" } as any,
  cardHover: { backgroundColor: colors.primarySoft },
  cardPressed: { opacity: 0.86 },
  summaryDate: { width: 58, alignItems: "center", paddingTop: spacing.xs },
  dayNumber: { color: colors.primary, fontSize: 28, fontWeight: "900" },
  weekday: { color: colors.muted, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  cardBody: { flex: 1 },
  cardBodyOffset: { marginLeft: 58 },
  cardTime: { color: colors.primary, fontSize: 13, fontWeight: "900" },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: "900", marginTop: spacing.xs, marginBottom: spacing.xs },
  detail: { color: colors.text, fontSize: 14, lineHeight: 21, fontWeight: "600" },
  status: { color: colors.primary, fontSize: 12, fontWeight: "800", marginTop: spacing.xs },
  cardActions: { marginLeft: 58, marginTop: spacing.md, alignItems: "flex-start" },
  reportButton: { alignSelf: "flex-start", minHeight: 38, borderRadius: radii.md, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  reportButtonText: { color: colors.primary, fontSize: 13, fontWeight: "900" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  actionButton: { minHeight: 40, borderRadius: radii.md, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center" },
  acceptButton: { backgroundColor: colors.primary },
  declineButton: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.line },
  acceptButtonText: { color: colors.surface, fontSize: 13, fontWeight: "800" },
  declineButtonText: { color: colors.text, fontSize: 13, fontWeight: "800" },
});

