import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useAuthStore } from "../../src/store/authStore";

export default function DashboardScreen() {
  const { user } = useAuthStore();

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Olá, {user?.name?.split(" ")[0]} 👋</Text>
      <Text style={styles.role}>{formatRole(user?.role)}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>📅 Próximas Escalas</Text>
        <Text style={styles.cardBody}>Nenhuma escala agendada</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎵 Meus Ministérios</Text>
        <Text style={styles.cardBody}>Acesse a aba Ministérios</Text>
      </View>
    </View>
  );
}

function formatRole(role?: string) {
  const labels: Record<string, string> = {
    GLOBAL_ADMIN: "Administrador Global",
    TENANT_ADMIN: "Líder da Igreja",
    MINISTRY_LEADER: "Líder de Ministério",
    MEMBER: "Membro",
  };
  return labels[role ?? ""] ?? "";
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    padding: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
  },
  role: {
    fontSize: 13,
    color: "#e94560",
    marginBottom: 32,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  card: {
    backgroundColor: "#16213e",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#0f3460",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 14,
    color: "#888",
  },
});
