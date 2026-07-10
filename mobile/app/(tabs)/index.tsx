import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { CalendarClock, Church, ClipboardList, Music2, Plus, UserPlus, UsersRound } from "lucide-react-native";
import { Button, Card, EmptyState, ErrorBanner, LoadingState, ScheduleStatusBadge, Screen, SectionHeader } from "../../src/components/ui";
import { useAuthStore } from "../../src/store/authStore";
import { useMemberStore } from "../../src/store/memberStore";
import { useScheduleStore } from "../../src/store/scheduleStore";
import { colors, radii, spacing, typography } from "../../src/theme";
import { countPendingSchedules, formatScheduleDate, getNextSchedule } from "../../src/utils/scheduleFormat";
import { can, canManageChurch, canManageMembers, canViewMembers, formatRoleLabel, isGlobalAdmin } from "../../src/utils/permissions";
import { canManageMusic } from "../../src/utils/musicPermissions";

export default function DashboardScreen() {
  const router = useRouter();
  const { user, tenant } = useAuthStore();
  const { schedules, loading, error, loadMySchedules } = useScheduleStore();
  const { members, loading: membersLoading, loadMembers } = useMemberStore();
  const firstName = user?.name?.split(" ")[0] ?? "Usuário";
  const pendingCount = countPendingSchedules(schedules);
  const nextSchedule = getNextSchedule(schedules);
  const pendingSchedules = schedules.filter((item) => item.status === "PENDING").slice(0, 3);
  const membersWithoutMinistry = members.filter((member) => !member.ministries?.length);
  const membersWithoutInstrument = members.filter((member) => !member.instruments?.length);
  const canSeeMembers = canViewMembers(user);
  const canCreateMembers = canManageMembers(user);
  const canCreateSchedules = can(user, "schedule:create");
  const canCreateSongs = canManageMusic(user, "song:create");
  const canCreateMinistries = canManageChurch(user);

  useEffect(() => {
    void loadMySchedules();
  }, [loadMySchedules]);

  useEffect(() => {
    if (canSeeMembers && members.length === 0) {
      void loadMembers();
    }
  }, [canSeeMembers, loadMembers, members.length]);

  const quickActions = [
    canCreateSchedules
      ? {
          title: "Criar escala",
          icon: <CalendarClock color={colors.primary} size={20} strokeWidth={2.4} />,
          onPress: () => router.push("/schedules/new" as never),
          accessibilityLabel: "Criar nova escala",
        }
      : null,
    canCreateMembers
      ? {
          title: "Convidar membro",
          icon: <UserPlus color={colors.primary} size={20} strokeWidth={2.4} />,
          onPress: () => router.push("/members/new" as never),
          accessibilityLabel: "Convidar membro",
        }
      : null,
    canCreateSongs
      ? {
          title: "Cadastrar música",
          icon: <Music2 color={colors.primary} size={20} strokeWidth={2.4} />,
          onPress: () => router.push("/songs/new" as never),
          accessibilityLabel: "Cadastrar música",
        }
      : null,
    canCreateMinistries
      ? {
          title: "Criar ministério",
          icon: <Church color={colors.primary} size={20} strokeWidth={2.4} />,
          onPress: () => router.push("/ministries" as never),
          accessibilityLabel: "Criar ministério",
        }
      : null,
  ].filter(Boolean);

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Hoje</Text>
        <Text style={styles.greeting}>Olá, {firstName}</Text>
        <Text style={styles.role}>Sua central de ações ministeriais</Text>
        <Text style={styles.tenant}>
          {isGlobalAdmin(user)
            ? "Acesso global ao sistema"
            : `${formatRoleLabel(user?.role)} - ${tenant?.name ?? "Igreja não identificada"}`}
        </Text>
      </View>

      <ErrorBanner
        message={error}
        style={styles.errorBanner}
        action={error ? (
          <Button
            title="Tentar novamente"
            variant="secondary"
            size="sm"
            style={styles.retryButton}
            onPress={() => void loadMySchedules({ refresh: true })}
            accessibilityLabel="Tentar carregar dashboard novamente"
          />
        ) : null}
      />

      <Card style={styles.card}>
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
          <LoadingState centered={false} style={styles.inlineLoading} />
        ) : nextSchedule ? (
          <View style={styles.scheduleDetails}>
            <Text style={styles.cardBody}>Ministério: {nextSchedule.schedule.ministry?.name ?? "Não informado"}</Text>
            <Text style={styles.cardBody}>Função: {nextSchedule.role || "Não informada"}</Text>
            <Text style={styles.cardBody}>Data: {formatScheduleDate(nextSchedule.schedule.date)}</Text>
            <View style={styles.statusRow}>
              <Text style={styles.cardBody}>Status:</Text>
              <ScheduleStatusBadge status={nextSchedule.status} />
            </View>
          </View>
        ) : (
          <EmptyState
            title="Sem compromissos agendados"
            description="Quando uma escala for publicada, ela aparecerá aqui com data, horário e ministério."
            style={styles.cardEmptyState}
          />
        )}

        <Button
          title="Ver minhas escalas"
          icon={<CalendarClock color={colors.surface} size={16} strokeWidth={2.4} />}
          size="lg"
          style={styles.primaryButton}
          onPress={() => router.push("/schedules" as never)}
          accessibilityLabel="Ver minhas escalas"
        />
      </Card>

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

      <Card style={styles.card}>
        <SectionHeader
          title="Ações rápidas"
          subtitle={quickActions.length ? "Atalhos disponíveis para o seu perfil" : "Resumo da sua rotina ministerial"}
          style={styles.sectionHeader}
        />
        {quickActions.length ? (
          <View style={styles.actionGrid}>
            {quickActions.map((action) => action ? (
              <Button
                key={action.title}
                title={action.title}
                icon={action.icon}
                variant="secondary"
                style={styles.actionButton}
                textStyle={styles.actionButtonText}
                onPress={action.onPress}
                accessibilityLabel={action.accessibilityLabel}
              />
            ) : null)}
          </View>
        ) : (
          <Text style={styles.cardBody}>Acompanhe suas escalas, pendências e próximos compromissos por aqui.</Text>
        )}
      </Card>

      <Card style={styles.card}>
        <SectionHeader
          title="Escalas pendentes"
          subtitle={pendingCount ? `${pendingCount} convite(s) aguardando resposta` : "Nenhuma pendência no momento"}
          style={styles.sectionHeader}
        />
        {loading && schedules.length === 0 ? (
          <LoadingState centered={false} style={styles.inlineLoading} />
        ) : pendingSchedules.length ? (
          <View style={styles.pendingList}>
            {pendingSchedules.map((assignment) => (
              <View key={assignment.id} style={styles.pendingItem}>
                <View style={styles.pendingText}>
                  <Text style={styles.itemTitle}>{assignment.schedule.title}</Text>
                  <Text style={styles.itemMeta}>{assignment.role || "Função não informada"} - {formatScheduleDate(assignment.schedule.date)}</Text>
                </View>
                <ScheduleStatusBadge status={assignment.status} />
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            title="Tudo em dia"
            description="Quando houver uma escala pendente de resposta, ela aparecerá aqui."
            style={styles.compactEmpty}
          />
        )}
        <Button
          title="Ver escalas"
          variant="secondary"
          size="sm"
          style={styles.secondaryButton}
          onPress={() => router.push("/schedules" as never)}
          accessibilityLabel="Ver escalas"
        />
      </Card>

      {canSeeMembers ? (
        <Card style={styles.card}>
          <SectionHeader
            title="Atenção em membros"
            subtitle={membersLoading && members.length === 0 ? "Carregando membros" : "Cadastros que podem precisar de complemento"}
            style={styles.sectionHeader}
          />
          {membersLoading && members.length === 0 ? (
            <LoadingState centered={false} style={styles.inlineLoading} />
          ) : (
            <View style={styles.summaryRow}>
              <View style={styles.metricNeutral}>
                <UsersRound color={colors.warning} size={22} strokeWidth={2.4} />
                <Text style={styles.metricValue}>{membersWithoutMinistry.length}</Text>
                <Text style={styles.metricLabel}>Sem ministério</Text>
              </View>
              <View style={styles.metricNeutral}>
                <Plus color={colors.info} size={22} strokeWidth={2.4} />
                <Text style={styles.metricValue}>{membersWithoutInstrument.length}</Text>
                <Text style={styles.metricLabel}>Sem instrumento/cargo</Text>
              </View>
            </View>
          )}
          <Button
            title="Ver membros"
            variant="secondary"
            size="sm"
            style={styles.secondaryButton}
            onPress={() => router.push("/members" as never)}
            accessibilityLabel="Ver membros"
          />
        </Card>
      ) : null}

      <Card style={styles.card}>
        <SectionHeader title="Atividades recentes" subtitle="Dados derivados das informações carregadas" style={styles.sectionHeader} />
        {nextSchedule ? (
          <View style={styles.activityList}>
            <View style={styles.activityItem}>
              <CalendarClock color={colors.primary} size={18} strokeWidth={2.4} />
              <View style={styles.activityText}>
                <Text style={styles.itemTitle}>Próxima escala definida</Text>
                <Text style={styles.itemMeta}>{nextSchedule.schedule.title} - {formatScheduleDate(nextSchedule.schedule.date)}</Text>
              </View>
            </View>
            {pendingCount ? (
              <View style={styles.activityItem}>
                <ClipboardList color={colors.warning} size={18} strokeWidth={2.4} />
                <View style={styles.activityText}>
                  <Text style={styles.itemTitle}>Convites pendentes</Text>
                  <Text style={styles.itemMeta}>{pendingCount} escala(s) aguardando sua resposta.</Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : (
          <EmptyState
            title="Sem atividades recentes"
            description="Assim que houver escalas ou pendências carregadas, elas aparecerão aqui."
            style={styles.compactEmpty}
          />
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardKicker}>Ministérios</Text>
        <Text style={styles.cardTitle}>Acompanhe suas equipes</Text>
        <Text style={styles.cardBody}>
          Use a aba Ministérios para ver ministérios, descrições e quantidade de membros.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.xl },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  greeting: {
    ...typography.heroTitle,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  role: {
    ...typography.subtitle,
    color: colors.text,
  },
  tenant: {
    ...typography.metadata,
    marginTop: spacing.sm,
    color: colors.muted,
  },
  errorBanner: { marginBottom: spacing.lg },
  retryButton: { alignSelf: "flex-start", marginBottom: spacing.lg },
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
  metricNeutral: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  metricValue: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.primaryDark,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  metricLabel: { ...typography.label, color: colors.text },
  card: {
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  sectionHeader: { marginBottom: spacing.md },
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
    ...typography.eyebrow,
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    ...typography.sectionTitle,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  cardBody: { ...typography.body, color: colors.text },
  scheduleDetails: { gap: spacing.xs, marginBottom: spacing.md },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  inlineLoading: { alignItems: "flex-start", marginBottom: spacing.md },
  cardEmptyState: {
    alignItems: "flex-start",
    borderWidth: 0,
    padding: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  compactEmpty: {
    alignItems: "flex-start",
    borderWidth: 0,
    padding: 0,
    marginBottom: spacing.md,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButton: {
    alignSelf: "flex-start",
    marginTop: spacing.md,
  },
  secondaryButton: {
    alignSelf: "flex-start",
    marginTop: spacing.md,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  actionButton: {
    minWidth: 150,
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonText: {
    flexShrink: 1,
    textAlign: "center",
  },
  pendingList: { gap: spacing.sm },
  pendingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  pendingText: { flex: 1 },
  itemTitle: { ...typography.cardTitle, color: colors.ink },
  itemMeta: { ...typography.metadata, color: colors.text },
  activityList: { gap: spacing.md },
  activityItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  activityText: { flex: 1 },
});
