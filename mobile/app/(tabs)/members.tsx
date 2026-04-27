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
import { Member } from "../../src/types";
import { colors, radii, screen, shadow, spacing } from "../../src/theme";

export default function MembersScreen() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/members")
      .then((res) => setMembers(res.data.data))
      .catch(() => Alert.alert("Erro", "Não foi possível carregar os membros"))
      .finally(() => setLoading(false));
  }, []);

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
        data={members}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Membros</Text>
            <Text style={styles.subtitle}>{members.length} pessoa(s) cadastrada(s)</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Nenhum membro cadastrado</Text>
            <Text style={styles.emptyText}>Os membros da igreja aparecerão nesta lista.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>{item.name[0]?.toUpperCase()}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.email}>{item.email}</Text>
              <Text style={styles.role}>{formatRole(item.role)}</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function formatRole(role: string) {
  const labels: Record<string, string> = {
    GLOBAL_ADMIN: "Admin global",
    TENANT_ADMIN: "Líder da igreja",
    MINISTRY_LEADER: "Líder de ministério",
    MEMBER: "Membro",
  };
  return labels[role] ?? role;
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
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.lg,
  },
  avatarLetter: { color: colors.primaryDark, fontSize: 20, fontWeight: "800" },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: "800", color: colors.ink, marginBottom: spacing.xs },
  email: { fontSize: 13, color: colors.muted, marginBottom: spacing.sm },
  role: { fontSize: 12, color: colors.primary, fontWeight: "800", textTransform: "uppercase" },
});
