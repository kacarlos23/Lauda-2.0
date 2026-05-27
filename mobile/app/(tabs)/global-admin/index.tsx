import { useEffect } from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Building2,
  CalendarClock,
  Guitar,
  Mail,
  RefreshCcw,
  ShieldAlert,
  UsersRound,
  Workflow,
} from "lucide-react-native";
import { useAdminStore } from "../../../src/store/adminStore";
import { useAuthStore } from "../../../src/store/authStore";
import { colors, radii, screen, shadow, spacing } from "../../../src/theme";
import { GlobalMinistry, GlobalUser } from "../../../src/types";
import { isGlobalAdmin } from "../../../src/utils/permissions";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(value)
  );
}

function countLabel(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    GLOBAL_ADMIN: "Admin global",
    TENANT_ADMIN: "Admin da igreja",
    MINISTRY_LEADER: "Líder",
    MEMBER: "Membro",
  };
  return labels[role] ?? role;
}

export default function GlobalAdminScreen() {
  const { user } = useAuthStore();
  const { tenants, users, ministries, loading, error, loadDashboard } = useAdminStore();
  const hasData = tenants.length > 0 || users.length > 0 || ministries.length > 0;
  const totals = tenants.reduce(
    (acc, tenant) => ({
      users: acc.users + tenant._count.users,
      ministries: acc.ministries + tenant._count.ministries,
      schedules: acc.schedules + tenant._count.schedules,
      instruments: acc.instruments + tenant._count.instruments,
    }),
    { users: 0, ministries: 0, schedules: 0, instruments: 0 }
  );

  useEffect(() => {
    if (isGlobalAdmin(user)) {
      void loadDashboard();
    }
  }, [loadDashboard, user?.role]);

  if (!isGlobalAdmin(user)) {
    return (
      <SafeAreaView style={styles.safe} edges={["left", "right"]}>
        <View style={styles.denied}>
          <ShieldAlert color={colors.danger} size={30} strokeWidth={2.4} />
          <Text style={styles.deniedTitle}>Acesso negado</Text>
          <Text style={styles.deniedText}>Esta área é exclusiva para administradores globais.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Painel global</Text>
          <Text style={styles.subtitle}>Igrejas, usuários e ministérios do banco real</Text>
        </View>

        {!error || hasData ? (
          <>
            <View style={styles.summaryRow}>
              <Metric icon={Building2} label="Igrejas" value={tenants.length} />
              <Metric icon={UsersRound} label="Usuários" value={totals.users || users.length} />
              <Metric icon={CalendarClock} label="Escalas" value={totals.schedules} />
            </View>
            <View style={styles.summaryRow}>
              <Metric icon={Workflow} label="Ministérios" value={totals.ministries || ministries.length} />
              <Metric icon={Guitar} label="Instrumentos" value={totals.instruments} />
            </View>
          </>
        ) : null}

        {loading && !hasData ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Carregando painel global...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>Não foi possível carregar o painel global.</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Text style={styles.stateHint}>
              Verifique se o backend atual está rodando, se o token é de GLOBAL_ADMIN e se a base URL aponta para a API
              correta.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadDashboard} accessibilityRole="button">
              <RefreshCcw color={colors.primary} size={16} strokeWidth={2.5} />
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : tenants.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>Nenhuma igreja cadastrada.</Text>
          </View>
        ) : (
          <>
            <Section title="Igrejas" subtitle={`${tenants.length} registros`}>
              {tenants.map((tenant) => (
                <View key={tenant.id} style={styles.tableRow}>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>{tenant.name}</Text>
                    <Text style={styles.rowMeta}>Criada em {formatDate(tenant.createdAt)}</Text>
                  </View>
                  <View style={styles.countRow}>
                    <Badge text={countLabel(tenant._count.users, "usuário", "usuários")} />
                    <Badge text={countLabel(tenant._count.ministries, "ministério", "ministérios")} />
                    <Badge text={countLabel(tenant._count.instruments, "instrumento", "instrumentos")} />
                    <Badge text={countLabel(tenant._count.schedules, "escala", "escalas")} />
                  </View>
                </View>
              ))}
            </Section>

            <Section title="Usuários" subtitle={`${users.length} registros`}>
              {users.length === 0 ? (
                <Text style={styles.emptyText}>Nenhum usuário encontrado.</Text>
              ) : (
                users.map((globalUser) => <UserRow key={globalUser.id} user={globalUser} />)
              )}
            </Section>

            <Section title="Ministérios" subtitle={`${ministries.length} registros`}>
              {ministries.length === 0 ? (
                <Text style={styles.emptyText}>Nenhum ministério encontrado.</Text>
              ) : (
                ministries.map((ministry) => <MinistryRow key={ministry.id} ministry={ministry} />)
              )}
            </Section>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.metric}>
      <Icon color={colors.primaryDark} size={22} strokeWidth={2.4} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.table}>{children}</View>
    </View>
  );
}

function UserRow({ user }: { user: GlobalUser }) {
  return (
    <View style={styles.tableRow}>
      <View style={styles.rowHeader}>
        <View style={styles.rowMain}>
          <Text style={styles.rowTitle}>{user.name}</Text>
          <View style={styles.inlineMeta}>
            <Mail color={colors.muted} size={14} strokeWidth={2.4} />
            <Text style={styles.rowMeta}>{user.email}</Text>
          </View>
        </View>
        <Badge text={roleLabel(user.role)} />
      </View>
      <Text style={styles.rowMeta}>{user.tenant?.name ?? "Igreja não informada"}</Text>
    </View>
  );
}

function MinistryRow({ ministry }: { ministry: GlobalMinistry }) {
  return (
    <View style={styles.tableRow}>
      <View style={styles.rowHeader}>
        <View style={styles.rowMain}>
          <Text style={styles.rowTitle}>{ministry.name}</Text>
          <Text style={styles.rowMeta}>{ministry.tenant.name}</Text>
        </View>
        <View style={styles.countRowRight}>
          <Badge text={countLabel(ministry._count?.members ?? 0, "membro", "membros")} />
          <Badge text={countLabel(ministry._count?.schedules ?? 0, "escala", "escalas")} />
        </View>
      </View>
      {ministry.description ? <Text style={styles.rowDescription}>{ministry.description}</Text> : null}
    </View>
  );
}

function Badge({ text }: { text: string }) {
  return <Text style={styles.badge}>{text}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    width: "100%",
    maxWidth: screen.listMaxWidth,
    alignSelf: "center",
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: { marginBottom: spacing.xl },
  title: { fontSize: 30, fontWeight: "900", color: colors.ink, marginBottom: spacing.sm },
  subtitle: { fontSize: 15, color: colors.muted, fontWeight: "700", lineHeight: 22 },
  summaryRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.lg },
  metric: {
    flex: 1,
    minHeight: 116,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  metricValue: { fontSize: 26, fontWeight: "900", color: colors.primaryDark, marginTop: spacing.sm },
  metricLabel: { color: colors.text, fontSize: 12, fontWeight: "800", marginTop: spacing.xs },
  stateBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: "flex-start",
    ...shadow,
  },
  stateText: { color: colors.muted, fontSize: 15, fontWeight: "700", lineHeight: 22 },
  stateHint: { color: colors.text, fontSize: 13, fontWeight: "700", lineHeight: 20 },
  errorText: { color: colors.danger, fontSize: 15, fontWeight: "800", lineHeight: 22 },
  retryButton: {
    minHeight: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  retryButtonText: { color: colors.primary, fontSize: 13, fontWeight: "900" },
  section: { marginTop: spacing.lg },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  sectionSubtitle: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  table: { gap: spacing.md },
  tableRow: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow,
  },
  rowHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
  rowMain: { flex: 1, gap: spacing.xs },
  rowTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  rowMeta: { color: colors.muted, fontSize: 12, fontWeight: "700", lineHeight: 18 },
  rowDescription: { color: colors.text, fontSize: 13, fontWeight: "700", lineHeight: 19 },
  inlineMeta: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" },
  countRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  countRowRight: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: spacing.sm },
  badge: {
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 12,
    fontWeight: "800",
  },
  emptyText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  denied: {
    flex: 1,
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  deniedTitle: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  deniedText: { color: colors.muted, fontSize: 15, fontWeight: "700", textAlign: "center" },
});
