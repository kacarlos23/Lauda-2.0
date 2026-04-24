import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useAuthStore } from "../../src/store/authStore";
import { useRouter } from "expo-router";

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert("Sair", "Deseja encerrar sua sessão?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarLetter}>{user?.name?.[0].toUpperCase()}</Text>
      </View>

      <Text style={styles.name}>{user?.name}</Text>
      <Text style={styles.email}>{user?.email}</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{formatRole(user?.role)}</Text>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
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
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#e94560",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarLetter: { fontSize: 40, fontWeight: "800", color: "#fff" },
  name: { fontSize: 24, fontWeight: "800", color: "#fff", marginBottom: 4 },
  email: { fontSize: 14, color: "#888", marginBottom: 16 },
  badge: {
    backgroundColor: "#0f3460",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 48,
  },
  badgeText: { color: "#e94560", fontSize: 13, fontWeight: "700", textTransform: "uppercase" },
  logoutBtn: {
    width: "100%",
    backgroundColor: "#e94560",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  logoutText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
