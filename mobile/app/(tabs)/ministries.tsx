import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../src/services/api";
import { Ministry } from "../../src/types";
import { colors, radii, screen, shadow, spacing } from "../../src/theme";

export default function MinistriesScreen() {
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMinistries();
  }, []);

  const fetchMinistries = async () => {
    try {
      const res = await api.get("/ministries");
      setMinistries(res.data.data);
    } catch {
      Alert.alert("Erro", "Não foi possível carregar os ministérios");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
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
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Ministérios</Text>
            <Text style={styles.subtitle}>{ministries.length} grupo(s) ativo(s)</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Nenhum ministério cadastrado</Text>
            <Text style={styles.emptyText}>Crie ministérios para organizar equipes e escalas.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{item._count?.members ?? 0}</Text>
              </View>
            </View>
            {item.description ? <Text style={styles.cardDesc}>{item.description}</Text> : null}
            <Text style={styles.cardMeta}>membro(s) vinculados</Text>
          </View>
        )}
      />
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
    paddingBottom: spacing.xxl,
  },
  header: { marginBottom: spacing.lg },
  title: { fontSize: 28, fontWeight: "800", color: colors.ink, marginBottom: spacing.xs },
  subtitle: { fontSize: 15, color: colors.muted },
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
});
