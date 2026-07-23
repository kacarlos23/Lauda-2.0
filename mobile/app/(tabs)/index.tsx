import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import {
  CalendarClock,
  Church,
  ClipboardList,
  Music2,
  Plus,
  UserPlus,
  UsersRound,
} from "lucide-react-native";
import {
  Button,
  EmptyState,
  ErrorBanner,
  LoadingState,
  Metric,
  ScheduleStatusBadge,
  Screen,
  SectionHeader,
} from "../../src/components/ui";
import { useAuthStore } from "../../src/store/authStore";
import { useMemberStore } from "../../src/store/memberStore";
import { useScheduleStore } from "../../src/store/scheduleStore";
import { colors, radii, spacing, typography } from "../../src/theme";
import { countPendingSchedules, formatScheduleDate, getNextSchedule } from "../../src/utils/scheduleFormat";
import {
  can,
  canAccessChurchAdmin,
  canAccessGlobalAdminArea,
  canManageMembers,
  canViewMembers,
  formatRoleLabel,
  isGlobalAdmin,
} from "../../src/utils/permissions";
import { canManageMusic } from "../../src/utils/musicPermissions";
import { canManageInstrumentCatalog } from "../../src/utils/instrumentCatalog";
import { canCreateSchedule } from "../../src/utils/schedulePermissions";

const TEXT = {
  userFallback: "Usuário",
  createSong: "Cadastrar música",
  createMinistry: "Criar ministério",
  hello: "Olá",
  central: "Sua central de ações ministeriais",
  churchUnknown: "Igreja não identificada",
  nextSchedule: "Próxima escala",
  ministryLabel: "Ministério",
  notInformedMale: "Não informado",
  roleLabel: "Função",
  notInformedFemale: "Não informada",
  nextScheduleDescription: "Quando uma escala for publicada, ela aparecerá aqui com data, horário e ministério.",
  quickActions: "Ações rápidas",
  shortcutsAvailable: "Atalhos disponíveis para o seu perfil",
  followRoutine: "Acompanhe suas escalas, pendências e próximos compromissos por aqui.",
  noPendingNow: "Nenhuma pendência no momento",
  roleNotInformed: "Função não informada",
  pendingDescription: "Quando houver uma escala pendente de resposta, ela aparecerá aqui.",
  membersAttention: "Atenção em membros",
  noMinistry: "Sem ministério",
  recentActivitiesSubtitle: "Dados derivados das informações carregadas",
  nextScheduleDefined: "Próxima escala definida",
  recentActivitiesDescription: "Assim que houver escalas ou pendências carregadas, elas aparecerão aqui.",
  ministries: "Ministérios",
  ministriesDescription: "Consulte equipes, descrições e quantidade de membros em um único lugar.",
} as const;

export default function DashboardScreen() {
  const router = useRouter();
  const { user, tenant } = useAuthStore();
  const { schedules, loading, error, loadMySchedules } = useScheduleStore();
  const { members, loading: membersLoading, loadMembers } = useMemberStore();
  const firstName = user?.name?.split(" ")[0] ?? TEXT.userFallback;
  const pendingCount = countPendingSchedules(schedules);
  const nextSchedule = getNextSchedule(schedules);
  const pendingSchedules = schedules.filter((item) => item.status === "PENDING").slice(0, 3);
  const membersWithoutMinistry = members.filter((member) => !member.ministries?.length);
  const membersWithoutInstrument = members.filter((member) => !member.instruments?.length);
  const canSeeMembers = canViewMembers(user);
  const canCreateMembers = canManageMembers(user);
  const canCreateSchedules = canCreateSchedule(user);
  const canCreateSongs = canManageMusic(user, "song:create");
  const canCreateMinistries = can(user, "ministry:create");
  const canManageArtists = canManageMusic(user, "song:edit") || canManageMusic(user, "song:create");
  const canManageInstruments = canManageInstrumentCatalog(user);
  const canOpenChurchAdmin = canAccessChurchAdmin(user);
  const canOpenGlobalAdmin = canAccessGlobalAdminArea(user);

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
          icon: <CalendarClock color={colors.primary} size={19} strokeWidth={2.2} />,
          onPress: () => router.push("/schedules/new" as never),
          accessibilityLabel: "Criar nova escala",
        }
      : null,
    canCreateMembers
      ? {
          title: "Convidar membro",
          icon: <UserPlus color={colors.primary} size={19} strokeWidth={2.2} />,
          onPress: () => router.push("/members/new" as never),
          accessibilityLabel: "Convidar membro",
        }
      : null,
    canCreateSongs
      ? {
          title: TEXT.createSong,
          icon: <Music2 color={colors.primary} size={19} strokeWidth={2.2} />,
          onPress: () => router.push("/songs/new" as never),
          accessibilityLabel: TEXT.createSong,
        }
      : null,
    canCreateMinistries
      ? {
          title: TEXT.createMinistry,
          icon: <Church color={colors.primary} size={19} strokeWidth={2.2} />,
          onPress: () => router.push("/ministries" as never),
          accessibilityLabel: TEXT.createMinistry,
        }
      : null,
    canManageArtists
      ? {
          title: "Gerenciar artistas",
          icon: <Music2 color={colors.primary} size={19} strokeWidth={2.2} />,
          onPress: () => router.push("/artists" as never),
          accessibilityLabel: "Gerenciar artistas",
        }
      : null,
    canManageInstruments
      ? {
          title: "Instrumentos",
          icon: <Plus color={colors.primary} size={19} strokeWidth={2.2} />,
          onPress: () => router.push("/instruments?returnTo=/profile" as never),
          accessibilityLabel: "Gerenciar instrumentos e cargos",
        }
      : null,
    canOpenChurchAdmin
      ? {
          title: "Dados da igreja",
          icon: <Church color={colors.primary} size={19} strokeWidth={2.2} />,
          onPress: () => router.push("/church" as never),
          accessibilityLabel: "Abrir dados da igreja",
        }
      : null,
    canOpenGlobalAdmin
      ? {
          title: "Painel global",
          icon: <ClipboardList color={colors.primary} size={19} strokeWidth={2.2} />,
          onPress: () => router.push("/global-admin" as never),
          accessibilityLabel: "Abrir painel global",
        }
      : null,
  ].filter(Boolean);

  return (
    <Screen scroll>
      <View style={styles.pageHeader}>
        <Text style={styles.eyebrow}>Hoje</Text>
        <Text style={styles.greeting}>{TEXT.hello}, {firstName}</Text>
        <Text style={styles.role}>{TEXT.central}</Text>
        <Text style={styles.tenant}>
          {isGlobalAdmin(user)
            ? "Acesso global ao sistema"
            : `${formatRoleLabel(user?.role)} · ${tenant?.name ?? TEXT.churchUnknown}`}
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

      <View style={styles.heroLayout}>
        <View style={styles.nextPanel}>
          <Text style={styles.nextKicker}>{TEXT.nextSchedule}</Text>
          {loading && schedules.length === 0 ? (
            <LoadingState centered={false} style={styles.heroLoading} />
          ) : nextSchedule ? (
            <>
              <Text style={styles.nextTitle}>{nextSchedule.schedule.title}</Text>
              <Text style={styles.nextDate}>{formatScheduleDate(nextSchedule.schedule.date)}</Text>
              <Text style={styles.nextMeta}>
                {nextSchedule.schedule.ministry?.name ?? TEXT.notInformedMale} · {nextSchedule.role || TEXT.notInformedFemale}
              </Text>
              <View style={styles.nextFooter}>
                <ScheduleStatusBadge status={nextSchedule.status} />
                <Button
                  title="Ver escala"
                  style={styles.heroButton}
                  onPress={() => router.push("/schedules" as never)}
                  accessibilityLabel="Ver minhas escalas"
                />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.nextTitle}>Sem compromissos agendados</Text>
              <Text style={styles.nextEmpty}>{TEXT.nextScheduleDescription}</Text>
              <Button
                title="Ver minhas escalas"
                variant="secondary"
                style={styles.emptyHeroButton}
                onPress={() => router.push("/schedules" as never)}
                accessibilityLabel="Ver minhas escalas"
              />
            </>
          )}
        </View>

        <View style={styles.metricRail}>
          <Metric
            label="Pendências"
            value={pendingCount}
            detail={pendingCount ? "aguardando resposta" : "tudo em dia"}
            accent
            style={styles.metric}
          />
          <Metric
            label="Escalas"
            value={schedules.length}
            detail="carregadas para você"
            style={styles.metric}
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          variant="section"
          title={TEXT.quickActions}
          subtitle={quickActions.length ? TEXT.shortcutsAvailable : "Resumo da sua rotina ministerial"}
          style={styles.sectionHeader}
        />
        {quickActions.length ? (
          <View style={styles.actionGrid}>
            {quickActions.map((action, index) => action ? (
              <TouchableOpacity
                key={action.title}
                style={styles.actionButton}
                activeOpacity={0.72}
                onPress={action.onPress}
                accessibilityRole="button"
                accessibilityLabel={action.accessibilityLabel}
              >
                <Text style={styles.actionIndex}>{String(index + 1).padStart(2, "0")}</Text>
                {action.icon}
                <Text style={styles.actionText}>{action.title}</Text>
              </TouchableOpacity>
            ) : null)}
          </View>
        ) : (
          <Text style={styles.body}>{TEXT.followRoutine}</Text>
        )}
      </View>

      <View style={styles.infoColumns}>
        <View style={styles.listPanel}>
          <SectionHeader
            variant="section"
            title="Escalas pendentes"
            subtitle={pendingCount ? `${pendingCount} convite(s) aguardando resposta` : TEXT.noPendingNow}
            style={styles.panelHeader}
          />
          {loading && schedules.length === 0 ? (
            <LoadingState centered={false} style={styles.inlineLoading} />
          ) : pendingSchedules.length ? (
            <View>
              {pendingSchedules.map((assignment) => (
                <View key={assignment.id} style={styles.listRow}>
                  <View style={styles.rowMarker}><ClipboardList color={colors.primary} size={16} strokeWidth={2} /></View>
                  <View style={styles.rowCopy}>
                    <Text style={styles.itemTitle}>{assignment.schedule.title}</Text>
                    <Text style={styles.itemMeta}>
                      {assignment.role || TEXT.roleNotInformed} · {formatScheduleDate(assignment.schedule.date)}
                    </Text>
                  </View>
                  <ScheduleStatusBadge status={assignment.status} />
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              title="Tudo em dia"
              description={TEXT.pendingDescription}
              style={styles.compactEmpty}
            />
          )}
          <TouchableOpacity
            style={styles.textAction}
            onPress={() => router.push("/schedules" as never)}
            accessibilityRole="link"
            accessibilityLabel="Ver escalas"
          >
            <Text style={styles.textActionLabel}>Ver escalas</Text>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listPanel}>
          <SectionHeader
            variant="section"
            title="Atividade recente"
            subtitle={TEXT.recentActivitiesSubtitle}
            style={styles.panelHeader}
          />
          {nextSchedule ? (
            <View>
              <View style={styles.listRow}>
                <View style={styles.rowMarker}><CalendarClock color={colors.primary} size={16} strokeWidth={2} /></View>
                <View style={styles.rowCopy}>
                  <Text style={styles.itemTitle}>{TEXT.nextScheduleDefined}</Text>
                  <Text style={styles.itemMeta}>
                    {nextSchedule.schedule.title} · {formatScheduleDate(nextSchedule.schedule.date)}
                  </Text>
                </View>
              </View>
              {pendingCount ? (
                <View style={styles.listRow}>
                  <View style={styles.rowMarker}><ClipboardList color={colors.warning} size={16} strokeWidth={2} /></View>
                  <View style={styles.rowCopy}>
                    <Text style={styles.itemTitle}>Convites pendentes</Text>
                    <Text style={styles.itemMeta}>{pendingCount} escala(s) aguardando sua resposta.</Text>
                  </View>
                </View>
              ) : null}
            </View>
          ) : (
            <EmptyState
              title="Sem atividades recentes"
              description={TEXT.recentActivitiesDescription}
              style={styles.compactEmpty}
            />
          )}
        </View>
      </View>

      {canSeeMembers ? (
        <View style={styles.attentionSection}>
          <SectionHeader
            variant="section"
            title={TEXT.membersAttention}
            subtitle={membersLoading && members.length === 0 ? "Carregando membros" : "Cadastros que podem precisar de complemento"}
            style={styles.panelHeader}
          />
          {membersLoading && members.length === 0 ? (
            <LoadingState centered={false} style={styles.inlineLoading} />
          ) : (
            <View style={styles.attentionMetrics}>
              <Metric label={TEXT.noMinistry} value={membersWithoutMinistry.length} detail="cadastros para revisar" style={styles.attentionMetric} />
              <Metric label="Sem instrumento/cargo" value={membersWithoutInstrument.length} detail="cadastros para revisar" style={styles.attentionMetric} />
            </View>
          )}
          <TouchableOpacity
            style={styles.textAction}
            onPress={() => router.push("/members" as never)}
            accessibilityRole="link"
            accessibilityLabel="Ver membros"
          >
            <Text style={styles.textActionLabel}>Ver membros</Text>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.ministriesBar}
        onPress={() => router.push("/ministries" as never)}
        activeOpacity={0.76}
        accessibilityRole="link"
        accessibilityLabel="Abrir ministérios"
      >
        <View style={styles.ministryIcon}><Church color={colors.primary} size={20} strokeWidth={2.1} /></View>
        <View style={styles.ministryCopy}>
          <Text style={styles.ministryKicker}>{TEXT.ministries}</Text>
          <Text style={styles.ministryTitle}>Acompanhe suas equipes</Text>
          <Text style={styles.body}>{TEXT.ministriesDescription}</Text>
        </View>
        <Text style={styles.ministryArrow}>›</Text>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageHeader: { marginBottom: spacing.xl },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.accentText,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  greeting: {
    ...typography.heroTitle,
    color: colors.ink,
  },
  role: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.xs,
  },
  tenant: {
    ...typography.metadata,
    marginTop: spacing.sm,
    color: colors.muted,
  },
  errorBanner: { marginBottom: spacing.sm },
  retryButton: { alignSelf: "flex-start", marginBottom: spacing.lg },
  heroLayout: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  nextPanel: {
    flex: 2,
    minWidth: 280,
    minHeight: 232,
    justifyContent: "center",
    borderRadius: radii.lg,
    backgroundColor: colors.primaryDark,
    padding: spacing.xl,
  },
  nextKicker: {
    ...typography.eyebrow,
    color: colors.accentOnDark,
    textTransform: "uppercase",
    marginBottom: spacing.md,
  },
  nextTitle: {
    color: colors.inverse,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  nextDate: {
    ...typography.body,
    color: "#D7E2DC",
    marginTop: spacing.sm,
  },
  nextMeta: {
    ...typography.metadata,
    color: "#AFC0B8",
    marginTop: spacing.xs,
  },
  nextEmpty: {
    ...typography.body,
    color: "#AFC0B8",
    maxWidth: 520,
    marginTop: spacing.sm,
  },
  nextFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  heroButton: {
    minWidth: 120,
    backgroundColor: colors.accent,
  },
  emptyHeroButton: {
    alignSelf: "flex-start",
    marginTop: spacing.xl,
  },
  heroLoading: {
    minHeight: 96,
    justifyContent: "center",
  },
  metricRail: {
    flex: 1,
    minWidth: 220,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  metric: {
    flex: 1,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: { marginBottom: spacing.md },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  actionButton: {
    minHeight: 60,
    minWidth: 176,
    flexGrow: 1,
    flexBasis: 176,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  actionIndex: {
    ...typography.eyebrow,
    color: colors.accentText,
  },
  actionText: {
    ...typography.label,
    color: colors.ink,
    flex: 1,
  },
  infoColumns: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  listPanel: {
    flex: 1,
    minWidth: 280,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  panelHeader: { marginBottom: spacing.sm },
  listRow: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: spacing.sm,
  },
  rowMarker: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  rowCopy: { flex: 1 },
  itemTitle: { ...typography.label, color: colors.ink },
  itemMeta: { ...typography.metadata, color: colors.muted, marginTop: spacing.xxs },
  textAction: {
    minHeight: 44,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  textActionLabel: {
    ...typography.label,
    color: colors.primary,
  },
  actionArrow: {
    color: colors.primary,
    fontSize: 20,
    lineHeight: 20,
  },
  compactEmpty: {
    borderTopWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: spacing.lg,
  },
  inlineLoading: { alignItems: "flex-start", paddingVertical: spacing.lg },
  attentionSection: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.lg,
    marginBottom: spacing.lg,
  },
  attentionMetrics: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  attentionMetric: {
    flex: 1,
  },
  ministriesBar: {
    minHeight: 112,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceMuted,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    padding: spacing.lg,
  },
  ministryIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  ministryCopy: { flex: 1 },
  ministryArrow: {
    color: colors.primary,
    fontSize: 24,
    lineHeight: 24,
  },
  ministryKicker: {
    ...typography.eyebrow,
    color: colors.primary,
    textTransform: "uppercase",
  },
  ministryTitle: {
    ...typography.sectionTitle,
    color: colors.ink,
    marginTop: spacing.xs,
  },
  body: { ...typography.body, color: colors.text },
});
