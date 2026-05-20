import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { useMinistryStore } from "../../../src/store/ministryStore";
import { useAuthStore } from "../../../src/store/authStore";
import { colors, radii, screen, shadow, spacing } from "../../../src/theme";
import { BottomSheet } from "../../../src/components/BottomSheet";

export default function MinistriesScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { ministries, loading, error, fetchMinistries, refreshing, setRefreshing } = useMinistryStore();
  
  const [showCreate, setShowCreate] = useState(false);

  const isAdmin = user?.role === "TENANT_ADMIN" || user?.role === "GLOBAL_ADMIN";

  useEffect(() => {
    fetchMinistries();
  }, [fetchMinistries]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMinistries();
    setRefreshing(false);
  }, [fetchMinistries, setRefreshing]);

  if (loading && ministries.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <FlatList
        data={ministries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Ministérios</Text>
            <Text style={styles.subtitle}>{ministries.length} grupo(s) ativo(s)</Text>
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Nenhum ministério cadastrado</Text>
            <Text style={styles.emptyText}>Crie ministérios para organizar equipes e escalas.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.card} 
            activeOpacity={0.7}
            onPress={() => router.push(`/ministries/${item.id}` as any)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{item._count?.members ?? 0}</Text>
              </View>
            </View>
            {item.description ? (
              <Text style={styles.cardDesc} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
            <Text style={styles.cardMeta}>membro(s) vinculados</Text>
          </TouchableOpacity>
        )}
      />

      {isAdmin && (
        <TouchableOpacity 
          style={styles.fab} 
          activeOpacity={0.8}
          onPress={() => setShowCreate(true)}
        >
          <Plus color={colors.surface} size={24} />
        </TouchableOpacity>
      )}

      {/* Exemplo de uso do BottomSheet - a ser implementado */}
      <BottomSheet 
        isOpen={showCreate} 
        onClose={() => setShowCreate(false)} 
        title="Novo Ministério"
      >
        <View style={{ padding: spacing.xl }}>
          <Text style={{ color: colors.text }}>Formulário de criação virá aqui</Text>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    width: "100%",
    maxWidth: screen.listMaxWidth,
    alignSelf: "center",
    padding: spacing.xl,
    paddingBottom: 100, // Espaço para não cobrir o Ãºltimo item com o FAB
  },
  header: { marginBottom: spacing.lg },
  title: { fontSize: 28, fontWeight: "800", color: colors.ink, marginBottom: spacing.xs },
  subtitle: { fontSize: 15, color: colors.muted },
  errorText: { color: colors.danger, fontSize: 14, marginTop: spacing.sm },
  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
  },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: "800", marginBottom: spacing.sm },
  emptyText: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: { flex: 1, fontSize: 18, fontWeight: "800", color: colors.ink },
  countBadge: {
    minWidth: 34,
    height: 34,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  countText: { color: colors.primaryDark, fontSize: 14, fontWeight: "800" },
  cardDesc: { fontSize: 15, color: colors.text, lineHeight: 22, marginBottom: spacing.md },
  cardMeta: { fontSize: 12, color: colors.primary, fontWeight: "800", textTransform: "uppercase" },
  fab: {
    position: "absolute",
    bottom: spacing.xxl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    ...shadow,
  },
});
