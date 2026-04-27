import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Church } from "lucide-react-native";
import { useAuthStore } from "../../src/store/authStore";
import { colors, radii, screen, shadow, spacing } from "../../src/theme";

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
      router.replace("/(tabs)");
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
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="register-back">
            <ArrowLeft color={colors.primary} size={18} strokeWidth={2.4} />
            <Text style={styles.backText}>Voltar</Text>
          </TouchableOpacity>

          <View style={styles.brandMark}>
            <Church color={colors.surface} size={26} strokeWidth={2.6} />
          </View>
          <Text style={styles.title}>Nova igreja</Text>
          <Text style={styles.subtitle}>Configure a instituição e o primeiro administrador.</Text>

          <Text style={styles.label}>Nome da igreja *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Igreja Batista Central"
            placeholderTextColor={colors.muted}
            value={churchName}
            onChangeText={setChurchName}
            testID="register-church"
          />

          <Text style={styles.label}>Seu nome *</Text>
          <TextInput
            style={styles.input}
            placeholder="Nome completo do administrador"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
            testID="register-name"
          />

          <Text style={styles.label}>E-mail *</Text>
          <TextInput
            style={styles.input}
            placeholder="admin@suaigreja.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            testID="register-email"
          />

          <Text style={styles.label}>Senha *</Text>
          <TextInput
            style={styles.input}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor={colors.muted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            testID="register-password"
          />

          <Text style={styles.label}>Confirmar senha *</Text>
          <TextInput
            style={styles.input}
            placeholder="Repita a senha"
            placeholderTextColor={colors.muted}
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
            testID="register-confirm"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            testID="register-submit"
          >
            {loading ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.buttonText}>Criar conta</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  inner: {
    width: "100%",
    maxWidth: screen.maxWidth,
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow,
  },
  back: {
    marginBottom: spacing.xl,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  backText: { color: colors.primary, fontSize: 15, fontWeight: "700" },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  subtitle: { fontSize: 15, lineHeight: 22, color: colors.muted, marginBottom: spacing.xl },
  label: { color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    color: colors.ink,
    fontSize: 15,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radii.sm,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.surface, fontSize: 16, fontWeight: "700" },
});
