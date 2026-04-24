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
} from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../src/store/authStore";

export default function LoginScreen() {
  const { login } = useAuthStore();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Atenção", "Preencha todos os campos");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Erro ao fazer login. Tente novamente.";
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
      <View style={styles.inner}>
        <Text style={styles.title}>Lauda</Text>
        <Text style={styles.subtitle}>Gestão de Ministérios</Text>

        <TextInput
          style={styles.input}
          placeholder="E-mail"
          placeholderTextColor="#888"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Senha"
          placeholderTextColor="#888"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Entrar</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.registerLink}
          onPress={() => router.push("/(auth)/register")}
        >
          <Text style={styles.registerText}>
            Não tem conta?{" "}
            <Text style={styles.registerHighlight}>Cadastre sua Igreja</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    justifyContent: "center",
  },
  inner: {
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 42,
    fontWeight: "800",
    color: "#e94560",
    textAlign: "center",
    marginBottom: 4,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    marginBottom: 48,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: "#16213e",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    color: "#fff",
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#0f3460",
  },
  button: {
    backgroundColor: "#e94560",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1,
  },
  registerLink: {
    marginTop: 24,
    alignItems: "center",
  },
  registerText: {
    color: "#888",
    fontSize: 14,
  },
  registerHighlight: {
    color: "#e94560",
    fontWeight: "700",
  },
});
