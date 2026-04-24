import { useEffect, useState } from "react";
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, Alert,
} from "react-native";
import { api } from "../../src/services/api";
import { Member } from "../../src/types";

export default function MembersScreen() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/members")
      .then((res) => setMembers(res.data.data))
      .catch(() => Alert.alert("Erro", "Não foi possível carregar os membros"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>Nenhum membro cadastrado</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>{item.name[0].toUpperCase()}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.email}>{item.email}</Text>
              <Text style={styles.role}>{formatRole(item.role)}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

function formatRole(role: string) {
  const labels: Record<string, string> = {
    GLOBAL_ADMIN: "Admin Global",
    TENANT_ADMIN: "Líder da Igreja",
    MINISTRY_LEADER: "Líder de Ministério",
    MEMBER: "Membro",
  };
  return labels[role] ?? role;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a2e" },
  center: { flex: 1, backgroundColor: "#1a1a2e", justifyContent: "center", alignItems: "center" },
  list: { padding: 16 },
  empty: { color: "#888", textAlign: "center", marginTop: 60, fontSize: 15 },
  card: {
    backgroundColor: "#16213e",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#0f3460",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e94560",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  avatarLetter: { color: "#fff", fontSize: 20, fontWeight: "700" },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: "700", color: "#fff", marginBottom: 2 },
  email: { fontSize: 13, color: "#888", marginBottom: 4 },
  role: { fontSize: 12, color: "#e94560", fontWeight: "600", textTransform: "uppercase" },
});
