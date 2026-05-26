import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CalendarClock, ClipboardList, UsersRound } from "lucide-react-native";
import { useAuthStore } from "../../src/store/authStore";
import { colors, radii, screen, shadow, spacing } from "../../src/theme";

export default function DashboardScreen() {
  const { user } = useAuthStore();
  const firstName = user?.name?.split(" ")[0] ?? "Usuário";

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Hoje</Text>
          <Text style={styles.greeting}>Olá, {firstName}</Text>
          <Text style={styles.role}>{formatRole(user?.role)}</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.metric}>
            <CalendarClock color={colors.primaryDark} size={22} strokeWidth={2.4} />
            <Text style={styles.metricValue}>0</Text>
            <Text style={styles.metricLabel}>Escalas abertas</Text>
          </View>
          <View style={styles.metric}>
            <UsersRound color={colors.primaryDark} size={22} strokeWidth={2.4} />
            <Text style={styles.metricValue}>0</Text>
            <Text style={styles.metricLabel}>Convites pendentes</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <ClipboardList color={colors.primary} size={22} strokeWidth={2.4} />
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardKicker}>Próximas escalas</Text>
              <Text style={styles.cardTitle}>Sem compromissos agendados</Text>
            </View>
          </View>
          <Text style={styles.cardBody}>
            Quando uma escala for publicada, ela aparecerá aqui com data, horário e ministério.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardKicker}>Ministérios</Text>
          <Text style={styles.cardTitle}>Acompanhe suas equipes</Text>
          <Text style={styles.cardBody}>
            Use a aba Ministérios para ver grupos, descrições e quantidade de membros.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatRole(role?: string) {
  const labels: Record<string, string> = {
    GLOBAL_ADMIN: "Administrador global",
    TENANT_ADMIN: "Administrador da igreja",
    MINISTRY_LEADER: "Líder de ministério",
    MEMBER: "Membro",
  };
  return labels[role ?? ""] ?? "";
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
  eyebrow: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  greeting: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  role: {
    fontSize: 15,
    color: colors.muted,
    fontWeight: "600",
  },
  summaryRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  metric: {
    flex: 1,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  metricLabel: { color: colors.text, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.lg,
    ...shadow,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeaderText: { flex: 1 },
  cardKicker: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  cardBody: { fontSize: 15, lineHeight: 22, color: colors.muted },
});
