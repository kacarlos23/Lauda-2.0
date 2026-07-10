import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { CalendarClock, Plus } from "lucide-react-native";
import { ScheduleCard } from "../../../src/components/schedules/ScheduleCard";
import { scheduleService } from "../../../src/services/scheduleService";
import { useAuthStore } from "../../../src/store/authStore";
import { useScheduleStore } from "../../../src/store/scheduleStore";
import { Schedule, ScheduleAssignment } from "../../../src/types";
import { AppInput, Button, Card, Chip, EmptyState, ErrorBanner, FilterButton, FilterPanel, FilterSection, LoadingState, Screen, SectionHeader } from "../../../src/components/ui";
import { colors, radii, screen, spacing, typography } from "../../../src/theme";
import { NO_MINISTRY, emptyScheduleFilters, filterSchedules, hasActiveFilters, ScheduleListFilters, uniqueScheduleMinistries } from "../../../src/utils/listFilters";
import { can } from "../../../src/utils/permissions";

const monthTitle = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

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

function newScheduleHref(date: string) {
  return { pathname: "/schedules/new", params: { date } } as never;
}

export default function SchedulesScreen() {
  const router = useRouter();
  const { tenant, user } = useAuthStore();
  const { allSchedules, schedules: myAssignments, loading, refreshing, error, loadSchedules, loadMySchedules, updateScheduleStatus, createSchedule, resolveSubstitution } = useScheduleStore();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [declineAssignment, setDeclineAssignment] = useState<ScheduleAssignment | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [requestSubstitute, setRequestSubstitute] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [month, setMonth] = useState(() => new Date());
  const [filters, setFilters] = useState<ScheduleListFilters>(emptyScheduleFilters);
  const [draftFilters, setDraftFilters] = useState<ScheduleListFilters>(emptyScheduleFilters);
  const [showFilters, setShowFilters] = useState(false);
  const canManage = can(user, "schedule:view") || can(user, "schedule:create") || can(user, "schedule:edit");
  const canCreateSchedule = can(user, "schedule:create");
  const defaultRange = useMemo(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 3, 0);
    return { dateFrom: dateKey(from), dateTo: dateKey(to), limit: 120 };
  }, []);

  useEffect(() => {
    if (canManage) {
      void loadSchedules({ refresh: allSchedules.length > 0, params: defaultRange });
    }
    void loadMySchedules({ refresh: myAssignments.length > 0, params: defaultRange });
  }, [allSchedules.length, canManage, defaultRange, loadSchedules, loadMySchedules, myAssignments.length]);

  useFocusEffect(useCallback(() => {
    if (canManage) {
      void loadSchedules({ refresh: true, params: defaultRange });
    }
    void loadMySchedules({ refresh: true, params: defaultRange });
  }, [canManage, defaultRange, loadSchedules, loadMySchedules]));

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      canManage ? loadSchedules({ refresh: true, params: defaultRange }) : Promise.resolve(),
      loadMySchedules({ refresh: true, params: defaultRange }),
    ]);
  }, [canManage, defaultRange, loadSchedules, loadMySchedules]);

  const handleStatus = async (item: ScheduleAssignment, status: "ACCEPTED" | "DECLINED", options?: { declineReason?: string; requestSubstitute?: boolean }) => {
    setUpdatingId(item.id);
    try {
      await updateScheduleStatus(item.scheduleId, item.id, status, options);
    } finally {
      setUpdatingId(null);
    }
  };

  const submitDecline = async () => {
    if (!declineAssignment) return;
    const assignment = declineAssignment;
    setDeclineAssignment(null);
    await handleStatus(assignment, "DECLINED", {
      declineReason: declineReason.trim() || undefined,
      requestSubstitute,
    });
    setDeclineReason("");
    setRequestSubstitute(false);
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

  const duplicateSchedule = async (schedule: Schedule) => {
    if (!canCreateSchedule) return;
    setDuplicatingId(schedule.id);
    try {
      await createSchedule({
        title: `Copia de ${schedule.title}`,
        date: schedule.date,
        ministryId: schedule.ministryId,
        songIds: [...(schedule.songs ?? [])].sort((a, b) => a.order - b.order).map((entry) => entry.songId),
        assignments: (schedule.assignments ?? []).map((assignment) => ({ userId: assignment.userId, role: assignment.role })),
      });
    } catch (reason) {
      Alert.alert("Erro", reason instanceof Error ? reason.message : "Não foi possível duplicar a escala.");
    } finally {
      setDuplicatingId(null);
    }
  };

  const assignmentByScheduleId = useMemo(() => {
    const map = new Map<string, ScheduleAssignment>();
    myAssignments.forEach((assignment) => map.set(assignment.scheduleId, assignment));
    return map;
  }, [myAssignments]);

  const visibleSchedules = useMemo(
    () => canManage ? allSchedules : myAssignments.map((assignment) => assignment.schedule as Schedule),
    [allSchedules, canManage, myAssignments]
  );
  const filteredSchedules = useMemo(
    () => filterSchedules(visibleSchedules, filters, new Map([...assignmentByScheduleId].map(([id, assignment]) => [id, assignment.status]))),
    [assignmentByScheduleId, filters, visibleSchedules]
  );
  const activeFilters = hasActiveFilters(filters);
  const canApplyFilters = hasActiveFilters(draftFilters);
  const ministryFilterOptions = uniqueScheduleMinistries(visibleSchedules);

  const schedulesByDay = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    filteredSchedules.forEach((schedule) => {
      const key = dateKey(schedule.date);
      map.set(key, [...(map.get(key) ?? []), schedule]);
    });
    return map;
  }, [filteredSchedules]);

  const selectedSchedules = useMemo(
    () => [...(schedulesByDay.get(selectedDate) ?? [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [schedulesByDay, selectedDate]
  );
  const calendar = useMemo(() => buildCalendarDays(month), [month]);
  const todayKey = dateKey(new Date());

  const openFilters = () => {
    setDraftFilters(filters);
    setShowFilters(true);
  };

  const clearFilters = () => {
    setFilters(emptyScheduleFilters);
    setDraftFilters(emptyScheduleFilters);
    setShowFilters(false);
  };

  const applyFilters = () => {
    if (!hasActiveFilters(draftFilters)) return;
    setFilters(draftFilters);
    setShowFilters(false);
  };

  return (
    <Screen padded={false}>
      <Modal visible={Boolean(declineAssignment)} transparent animationType="fade" onRequestClose={() => setDeclineAssignment(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Recusar escala</Text>
            <Text style={styles.modalText}>Informe um motivo opcional e escolha se deseja solicitar substituto.</Text>
            <TextInput
              style={styles.reasonInput}
              value={declineReason}
              onChangeText={setDeclineReason}
              placeholder="Motivo da recusa"
              placeholderTextColor={colors.muted}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Motivo da recusa"
            />
            <TouchableOpacity style={styles.checkRow} onPress={() => setRequestSubstitute((current) => !current)} accessibilityRole="checkbox" accessibilityLabel="Solicitar substituto">
              <View style={[styles.checkbox, requestSubstitute && styles.checkboxActive]} />
              <Text style={styles.checkText}>Solicitar substituto</Text>
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <Button title="Cancelar" variant="secondary" onPress={() => setDeclineAssignment(null)} accessibilityLabel="Cancelar recusa" />
              <Button title="Recusar" onPress={() => void submitDecline()} accessibilityLabel="Confirmar recusa" />
            </View>
          </View>
        </View>
      </Modal>
      <FilterPanel
        visible={showFilters}
        title="Filtrar escalas"
        canApply={canApplyFilters}
        onApply={applyFilters}
        onClose={() => setShowFilters(false)}
        onClear={activeFilters || canApplyFilters ? clearFilters : undefined}
      >
        <AppInput
          label="Palavra-chave geral"
          value={draftFilters.query ?? ""}
          onChangeText={(query) => setDraftFilters((current) => ({ ...current, query }))}
          placeholder="Escala, ministério, música ou membro"
          accessibilityLabel="Buscar escalas"
        />
        <FilterSection title="Ministério">
          <Chip label="Sem ministério" active={draftFilters.ministryId === NO_MINISTRY} onPress={() => setDraftFilters((current) => ({ ...current, ministryId: NO_MINISTRY }))} />
          {ministryFilterOptions.map((ministry) => (
            <Chip key={ministry.id} label={ministry.name} active={draftFilters.ministryId === ministry.id} onPress={() => setDraftFilters((current) => ({ ...current, ministryId: ministry.id }))} />
          ))}
        </FilterSection>
        <FilterSection title="Status">
          <Chip label="Pendente" active={draftFilters.status === "PENDING"} onPress={() => setDraftFilters((current) => ({ ...current, status: "PENDING" }))} />
          <Chip label="Aceita" active={draftFilters.status === "ACCEPTED"} onPress={() => setDraftFilters((current) => ({ ...current, status: "ACCEPTED" }))} />
          <Chip label="Recusada" active={draftFilters.status === "DECLINED"} onPress={() => setDraftFilters((current) => ({ ...current, status: "DECLINED" }))} />
        </FilterSection>
        <FilterSection title="Periodo">
          <AppInput
            label="Data inicial"
            value={draftFilters.dateFrom ?? ""}
            onChangeText={(dateFrom) => setDraftFilters((current) => ({ ...current, dateFrom }))}
            placeholder="AAAA-MM-DD"
            accessibilityLabel="Filtrar escalas por data inicial"
          />
          <AppInput
            label="Data final"
            value={draftFilters.dateTo ?? ""}
            onChangeText={(dateTo) => setDraftFilters((current) => ({ ...current, dateTo }))}
            placeholder="AAAA-MM-DD"
            accessibilityLabel="Filtrar escalas por data final"
          />
        </FilterSection>
      </FilterPanel>
      <FlatList
        style={styles.flatList}
        data={selectedSchedules}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
        ListHeaderComponent={
          <View>
            <SectionHeader
              title="Escalas"
              subtitle={`Igreja atual: ${tenant?.name ?? "Não identificada"}`}
              action={canCreateSchedule ? (
                <View style={styles.headerActions}>
                  <FilterButton active={activeFilters} onPress={openFilters} accessibilityLabel="Abrir filtros de escalas" />
                  <Button
                    title="Nova Escala"
                    icon={<Plus color={colors.surface} size={18} />}
                    size="lg"
                    style={styles.newButton}
                    onPress={() => router.push(newScheduleHref(selectedDate))}
                    accessibilityLabel="Criar nova escala"
                  />
                </View>
              ) : (
                <FilterButton active={activeFilters} onPress={openFilters} accessibilityLabel="Abrir filtros de escalas" />
              )}
            />
            {activeFilters ? <Button title="Limpar filtros" variant="ghost" size="sm" style={styles.clearFiltersButton} onPress={clearFilters} accessibilityLabel="Limpar filtros de escalas" /> : null}
            <ErrorBanner
              message={error}
              style={styles.errorText}
              action={error ? (
                <Button
                  title="Tentar novamente"
                  variant="secondary"
                  size="sm"
                  style={styles.retryButton}
                  onPress={() => void handleRefresh()}
                  accessibilityLabel="Tentar carregar escalas novamente"
                />
              ) : null}
            />
            <Card style={styles.calendarCard}>
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
            </Card>
            <Text style={styles.sectionTitle}>Escalas do dia</Text>
            {loading && !visibleSchedules.length ? <LoadingState centered={false} style={styles.inlineLoading} /> : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon={<CalendarClock color={colors.primary} size={28} strokeWidth={2.3} />}
            title={activeFilters ? "Nenhuma escala encontrada" : "Nenhuma escala neste dia"}
            description={activeFilters ? "Ajuste ou limpe os filtros para ver outras escalas." : "Selecione outro dia no calendário ou crie uma nova escala."}
            action={canCreateSchedule ? (
              activeFilters ? (
                <Button title="Limpar filtros" variant="secondary" onPress={clearFilters} accessibilityLabel="Limpar filtros de escalas" />
              ) : (
                <Button
                  title="Criar escala"
                  size="lg"
                  onPress={() => router.push(newScheduleHref(selectedDate))}
                  accessibilityLabel="Criar escala"
                />
              )
            ) : null}
          />
        }
        renderItem={({ item }) => {
          const assignment = assignmentByScheduleId.get(item.id);
          return (
            <ScheduleCard
              schedule={item}
              assignment={assignment}
              canManage={can(user, "schedule:edit") || can(user, "schedule:delete") || can(user, "schedule:assign_members")}
              updating={updatingId === assignment?.id}
              exporting={exportingId === item.id}
              duplicating={duplicatingId === item.id}
              onEdit={() => router.push(`/schedules/${item.id}/edit` as never)}
              onDuplicate={() => void duplicateSchedule(item)}
              onExport={() => void exportReport(item)}
              onAccept={assignment ? () => void handleStatus(assignment, "ACCEPTED") : undefined}
              onDecline={assignment ? () => setDeclineAssignment(assignment) : undefined}
              onRequestSubstitute={assignment ? () => {
                setRequestSubstitute(true);
                setDeclineAssignment(assignment);
              } : undefined}
              onResolveSubstitution={(target) => void resolveSubstitution(item.id, target.id, "Resolvido manualmente")}
            />
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flatList: { flex: 1 },
  list: { width: "100%", maxWidth: screen.listMaxWidth, alignSelf: "center", padding: spacing.xl, paddingBottom: screen.contentBottomPadding },
  newButton: { paddingHorizontal: spacing.md },
  headerActions: { flexDirection: "row", gap: spacing.sm, alignItems: "center", flexWrap: "wrap" },
  errorText: { marginBottom: spacing.sm },
  retryButton: { alignSelf: "flex-start", marginBottom: spacing.md },
  clearFiltersButton: { alignSelf: "flex-start" },
  calendarCard: { padding: spacing.lg, marginBottom: spacing.lg },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  monthTitle: { ...typography.cardTitle, color: colors.ink, textTransform: "capitalize" },
  monthNav: { color: colors.primary, fontSize: 30, fontWeight: "700", paddingHorizontal: spacing.md },
  weekRow: { flexDirection: "row" },
  weekLabel: { ...typography.badge, flex: 1, textAlign: "center", color: colors.muted, marginBottom: spacing.xs },
  dayGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: `${100 / 7}%`, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.md },
  todayCell: { borderWidth: 1, borderColor: colors.primary },
  selectedCell: { backgroundColor: colors.primary },
  dayText: { ...typography.metadata, color: colors.text, textAlign: "center" },
  selectedDayText: { color: colors.surface },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary, marginTop: 3 },
  selectedDot: { backgroundColor: colors.surface },
  sectionTitle: { ...typography.sectionTitle, color: colors.ink, marginBottom: spacing.md },
  inlineLoading: { alignItems: "flex-start", marginBottom: spacing.md },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.46)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  modalCard: { width: "100%", maxWidth: 520, backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.line, padding: spacing.lg },
  modalTitle: { ...typography.sectionTitle, color: colors.ink, marginBottom: spacing.sm },
  modalText: { ...typography.body, color: colors.text, marginBottom: spacing.md },
  reasonInput: { minHeight: 96, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, color: colors.ink, padding: spacing.md, marginBottom: spacing.md },
  checkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.lg },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkText: { ...typography.label, color: colors.text },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, flexWrap: "wrap" },
  card: { padding: spacing.lg, marginBottom: spacing.md },
  cardPressArea: { flexDirection: "row", borderRadius: radii.lg },
  cardClickable: { cursor: "pointer" } as any,
  cardHover: { backgroundColor: colors.primarySoft },
  cardPressed: { opacity: 0.86 },
  summaryDate: { width: 58, alignItems: "center", paddingTop: spacing.xs },
  dayNumber: { color: colors.primary, fontSize: 28, fontWeight: "700", lineHeight: 33 },
  weekday: { ...typography.badge, color: colors.muted, textTransform: "uppercase" },
  cardBody: { flex: 1 },
  cardBodyOffset: { marginLeft: 58 },
  cardTime: { ...typography.label, color: colors.primary },
  cardTitle: { ...typography.cardTitle, color: colors.ink, marginTop: spacing.xs, marginBottom: spacing.xs },
  detail: { ...typography.metadata, color: colors.text },
  status: { ...typography.badge, color: colors.primary, marginTop: spacing.xs },
  assignmentStatusRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  cardActions: { marginLeft: 58, marginTop: spacing.md, alignItems: "flex-start" },
  reportButton: { alignSelf: "flex-start", borderWidth: 1, borderColor: colors.line },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  actionButton: { minHeight: 40, paddingHorizontal: spacing.lg },
});

