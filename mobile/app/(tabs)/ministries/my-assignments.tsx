import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Church } from "lucide-react-native";
import { ministryApi } from "../../../src/services/ministryApi";
import { MinistryMember } from "../../../src/types";
import { colors, radii, spacing } from "../../../src/theme";

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "Vínculo pendente",
    ACTIVE: "Vinculado",
    INACTIVE: "Inativo",
  };
  return labels[status] ?? status;
}

export default function MyAssignmentsScreen() {
  const [assignments, setAssignments] = useState<MinistryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAssignments = useCallback(async () => {
    try {
      setError(null);
      const data = await ministryApi.getMyAssignments();
      setAssignments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar suas atribuições.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadAssignments();
  };

  if (loading && assignments.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <FlatList
        data={assignments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Meus ministérios</Text>
            <Text style={styles.subtitle}>{assignments.length} participação(ões)</Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.iconBox}>
              <Church color={colors.primary} size={22} />
            </View>
            <View style={styles.info}>
              <View style={styles.row}>
                <Text style={styles.name}>{item.ministry?.name ?? "Ministério"}</Text>
                <Text style={styles.status}>{statusLabel(item.status)}</Text>
              </View>
              {item.role ? <Text style={styles.role}>{item.role}</Text> : null}
              {item.skills.length ? <Text style={styles.skills}>{item.skills.join(", ")}</Text> : null}
              {item.isLeader ? <Text style={styles.leader}>Líder</Text> : null}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Sem ministérios vinculados</Text>
            <Text style={styles.emptyText}>Suas participações aparecerão aqui quando um líder atribuir você.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" },
  list: { padding: spacing.xl, paddingBottom: spacing.xxl },
  header: { marginBottom: spacing.lg },
  title: { color: colors.ink, fontSize: 28, fontWeight: "800", marginBottom: spacing.xs },
  subtitle: { color: colors.muted, fontSize: 15 },
  errorText: { color: colors.danger, fontSize: 14, fontWeight: "700", marginTop: spacing.md },
  card: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  info: { flex: 1 },
  row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
  name: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: "800" },
  status: { color: colors.primary, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  role: { color: colors.text, fontSize: 14, fontWeight: "700", marginTop: spacing.xs },
  skills: { color: colors.text, fontSize: 13, marginTop: spacing.xs },
  leader: { color: colors.primary, fontSize: 12, fontWeight: "800", marginTop: spacing.xs },
  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.xl,
  },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: "800", marginBottom: spacing.sm },
  emptyText: { color: colors.muted, fontSize: 15, lineHeight: 22 },
});
