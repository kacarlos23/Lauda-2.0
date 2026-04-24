import { useEffect, useState } from "react";
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert,
} from "react-native";
import { api } from "../../src/services/api";
import { Ministry } from "../../src/types";
import { useAuthStore } from "../../src/store/authStore";

export default function MinistriesScreen() {
  const { user } = useAuthStore();
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.role === "TENANT_ADMIN" || user?.role === "GLOBAL_ADMIN";

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
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={ministries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>Nenhum ministério cadastrado</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            {item.description && (
              <Text style={styles.cardDesc}>{item.description}</Text>
            )}
            <Text style={styles.cardCount}>
              👥 {item._count?.members ?? 0} membro(s)
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a2e" },
  center: { flex: 1, backgroundColor: "#1a1a2e", justifyContent: "center", alignItems: "center" },
  list: { padding: 16 },
  empty: { color: "#888", textAlign: "center", marginTop: 60, fontSize: 15 },
  card: {
    backgroundColor: "#16213e",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#0f3460",
  },
  cardTitle: { fontSize: 17, fontWeight: "700", color: "#fff", marginBottom: 4 },
  cardDesc: { fontSize: 14, color: "#aaa", marginBottom: 8 },
  cardCount: { fontSize: 13, color: "#e94560", fontWeight: "600" },
});
