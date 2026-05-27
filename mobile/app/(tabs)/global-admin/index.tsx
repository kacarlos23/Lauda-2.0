import { useEffect } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Building2, CalendarClock, RefreshCcw, ShieldAlert, UsersRound } from "lucide-react-native";
import { useAdminStore } from "../../../src/store/adminStore";
import { useAuthStore } from "../../../src/store/authStore";
import { colors, radii, screen, shadow, spacing } from "../../../src/theme";
import { isGlobalAdmin } from "../../../src/utils/permissions";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(value)
  );
}

export default function GlobalAdminScreen() {
  const { user } = useAuthStore();
  const { tenants, loading, error, loadTenants } = useAdminStore();
  const totals = tenants.reduce(
    (acc, tenant) => ({
      users: acc.users + tenant._count.users,
      ministries: acc.ministries + tenant._count.ministries,
      schedules: acc.schedules + tenant._count.schedules,
    }),
    { users: 0, ministries: 0, schedules: 0 }
  );

  useEffect(() => {
    if (isGlobalAdmin(user)) {
      void loadTenants();
    }
  }, [loadTenants, user?.role]);

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
          <Text style={styles.subtitle}>Acesso global ao sistema</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.metric}>
            <Building2 color={colors.primaryDark} size={22} strokeWidth={2.4} />
            <Text style={styles.metricValue}>{tenants.length}</Text>
            <Text style={styles.metricLabel}>Igrejas</Text>
          </View>
          <View style={styles.metric}>
            <UsersRound color={colors.primaryDark} size={22} strokeWidth={2.4} />
            <Text style={styles.metricValue}>{totals.users}</Text>
            <Text style={styles.metricLabel}>Usuários</Text>
          </View>
          <View style={styles.metric}>
            <CalendarClock color={colors.primaryDark} size={22} strokeWidth={2.4} />
            <Text style={styles.metricValue}>{totals.schedules}</Text>
            <Text style={styles.metricLabel}>Escalas</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Carregando igrejas...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadTenants} accessibilityRole="button">
              <RefreshCcw color={colors.primary} size={16} strokeWidth={2.5} />
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : tenants.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>Nenhuma igreja cadastrada.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {tenants.map((tenant) => (
              <View key={tenant.id} style={styles.tenantCard}>
                <View style={styles.tenantHeader}>
                  <View style={styles.tenantIcon}>
                    <Building2 color={colors.primary} size={20} strokeWidth={2.5} />
                  </View>
                  <View style={styles.tenantTitleBox}>
                    <Text style={styles.tenantName}>{tenant.name}</Text>
                    <Text style={styles.tenantCreated}>Criada em {formatDate(tenant.createdAt)}</Text>
                  </View>
                </View>
                <View style={styles.countRow}>
                  <Text style={styles.countText}>{tenant._count.users} usuários</Text>
                  <Text style={styles.countText}>{tenant._count.ministries} ministérios</Text>
                  <Text style={styles.countText}>{tenant._count.schedules} escalas</Text>
                </View>
              </View>
            ))}
          </View>
        )}
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
    paddingBottom: spacing.xxl,
  },
  header: { marginBottom: spacing.xl },
  title: { fontSize: 30, fontWeight: "900", color: colors.ink, marginBottom: spacing.sm },
  subtitle: { fontSize: 15, color: colors.muted, fontWeight: "700" },
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
  list: { gap: spacing.md },
  tenantCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    ...shadow,
  },
  tenantHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  tenantIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  tenantTitleBox: { flex: 1 },
  tenantName: { color: colors.ink, fontSize: 17, fontWeight: "900", marginBottom: spacing.xs },
  tenantCreated: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  countRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  countText: {
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 12,
    fontWeight: "800",
  },
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
