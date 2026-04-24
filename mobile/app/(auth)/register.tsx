import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../src/store/authStore";

export default function RegisterScreen() {
  const { register } = useAuthStore();
  const router = useRouter();

  const [churchName, setChurchName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!churchName || !name || !email || !password) {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Atenção", "As senhas não coincidem");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Atenção", "A senha deve ter ao menos 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      await register(churchName.trim(), name.trim(), email.trim().toLowerCase(), password);
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Erro ao criar conta. Tente novamente.";
      Alert.alert("Erro", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Nova Igreja</Text>
        <Text style={styles.subtitle}>Crie a conta da sua instituição</Text>

        <Text style={styles.label}>Nome da Igreja *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: Igreja Batista Central"
          placeholderTextColor="#555"
          value={churchName}
          onChangeText={setChurchName}
        />

        <Text style={styles.label}>Seu nome *</Text>
        <TextInput
          style={styles.input}
          placeholder="Nome completo do administrador"
          placeholderTextColor="#555"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>E-mail *</Text>
        <TextInput
          style={styles.input}
          placeholder="admin@suaigreja.com"
          placeholderTextColor="#555"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Senha *</Text>
        <TextInput
          style={styles.input}
          placeholder="Mínimo 6 caracteres"
          placeholderTextColor="#555"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Text style={styles.label}>Confirmar senha *</Text>
        <TextInput
          style={styles.input}
          placeholder="Repita a senha"
          placeholderTextColor="#555"
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Criar Conta</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a2e" },
  inner: { paddingHorizontal: 32, paddingTop: 60, paddingBottom: 40 },
  back: { marginBottom: 32 },
  backText: { color: "#888", fontSize: 15 },
  title: {
    fontSize: 36,
    fontWeight: "800",
    color: "#e94560",
    marginBottom: 4,
    letterSpacing: 1,
  },
  subtitle: { fontSize: 14, color: "#888", marginBottom: 36 },
  label: { color: "#aaa", fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: "#16213e",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    color: "#fff",
    fontSize: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#0f3460",
  },
  button: {
    backgroundColor: "#e94560",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 1 },
});
