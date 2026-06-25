import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Plus, Search, User as UserIcon } from "lucide-react-native";
import { ministryApi } from "../../../../src/services/ministryApi";
import { useAuthStore } from "../../../../src/store/authStore";
import { MemberStatus, MinistryMember } from "../../../../src/types";
import { colors, radii, spacing } from "../../../../src/theme";
import { AppBackButton } from "../../../../src/components/AppBackButton";

const statuses: Array<MemberStatus | "ALL"> = ["ALL", "ACTIVE", "INACTIVE"];

function canAssign(role?: string): boolean {
  return role === "GLOBAL_ADMIN" || role === "TENANT_ADMIN" || role === "MINISTRY_LEADER";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ALL: "Todos",
    PENDING: "Vínculo pendente",
    ACTIVE: "Vinculado",
    INACTIVE: "Inativo",
  };
  return labels[status] ?? status;
}

export default function MinistryMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [members, setMembers] = useState<MinistryMember[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<MemberStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(
    async (nextPage = 1) => {
      if (!id) return;

      try {
        setError(null);
        const response = await ministryApi.listMembers(id, {
          search: search.trim() || undefined,
          status: status === "ALL" ? undefined : status,
          page: nextPage,
          limit: 20,
        });
        setMembers(nextPage === 1 ? response.items : [...members, ...response.items]);
        setPage(response.pagination.page);
        setTotalPages(response.pagination.totalPages);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível carregar membros.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id, members, search, status]
  );

  useEffect(() => {
    setLoading(true);
    loadMembers(1);
  }, [search, status]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadMembers(1);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <View style={styles.topBar}>
        <AppBackButton href={`/ministries/${id}`} compact />
        <Text style={styles.title}>Membros</Text>
        {canAssign(user?.role) ? (
          <TouchableOpacity
            onPress={() => router.push(`/ministries/assign?ministryId=${id}` as never)}
            style={styles.iconBtn}
            accessibilityRole="button"
          >
            <Plus color={colors.primary} size={22} />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
        ListHeaderComponent={
          <View style={styles.filters}>
            <View style={styles.searchBox}>
              <Search color={colors.muted} size={18} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar por nome ou e-mail"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.chips}>
              {statuses.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.chip, status === item && styles.chipActive]}
                  onPress={() => setStatus(item)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.chipText, status === item && styles.chipTextActive]}>{statusLabel(item)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.avatar}>
              <UserIcon color={colors.primary} size={20} />
            </View>
            <View style={styles.info}>
              <View style={styles.row}>
                <Text style={styles.name}>{item.user.name}</Text>
                <Text style={styles.badge}>{statusLabel(item.status)}</Text>
              </View>
              <Text style={styles.email}>{item.user.email}</Text>
              {item.role ? <Text style={styles.meta}>{item.role}</Text> : null}
              {item.skills.length ? <Text style={styles.skills}>{item.skills.join(", ")}</Text> : null}
              {item.isLeader ? <Text style={styles.leader}>Líder</Text> : null}
            </View>
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (
            <Text style={styles.emptyText}>Nenhum membro encontrado.</Text>
          )
        }
        onEndReached={() => {
          if (!loading && page < totalPages) loadMembers(page + 1);
        }}
        onEndReachedThreshold={0.4}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  iconBtn: { padding: spacing.sm },
  title: { color: colors.ink, fontSize: 22, fontWeight: "800" },
  list: { padding: spacing.xl, paddingBottom: spacing.xxl },
  filters: { marginBottom: spacing.lg },
  searchBox: {
    minHeight: 46,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  searchInput: { flex: 1, color: colors.ink, fontSize: 15 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    minHeight: 36,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  chipTextActive: { color: colors.primary },
  card: {
    flexDirection: "row",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  info: { flex: 1 },
  row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
  name: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: "800" },
  email: { color: colors.muted, fontSize: 13, marginTop: 2 },
  meta: { color: colors.text, fontSize: 14, fontWeight: "700", marginTop: spacing.xs },
  skills: { color: colors.text, fontSize: 13, marginTop: spacing.xs },
  badge: { color: colors.primary, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  leader: { color: colors.primary, fontSize: 12, fontWeight: "800", marginTop: spacing.xs },
  loader: { marginTop: spacing.xl },
  emptyText: { color: colors.muted, textAlign: "center", marginTop: spacing.xl },
  errorText: { color: colors.danger, fontSize: 14, fontWeight: "700", marginTop: spacing.md },
});
