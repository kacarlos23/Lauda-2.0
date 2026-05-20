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
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Link as LinkIcon, UserPlus } from "lucide-react-native";
import { AxiosError } from "axios";
import { useAuthStore } from "../../src/store/authStore";
import { colors, radii, screen, shadow, spacing } from "../../src/theme";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { error?: string } | undefined;
    return data?.error ?? "Erro ao cadastrar membro. Tente novamente.";
  }

  return error instanceof Error ? error.message : "Erro ao cadastrar membro. Tente novamente.";
}

export default function PublicMemberRegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const { memberRegister } = useAuthStore();

  const [inviteCode, setInviteCode] = useState(String(params.code ?? ""));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = inviteCode.trim();

    if (!normalizedCode) {
      setError("Informe o código de convite.");
      return;
    }

    if (name.trim().length < 2) {
      setError("Informe seu nome.");
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setError("Informe um e-mail valido.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter ao menos 6 caracteres.");
      return;
    }

    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const tenant = await memberRegister({
        inviteCode: normalizedCode,
        name: name.trim(),
        email: normalizedEmail,
        phone: phone.trim() || undefined,
        password,
      });
      Alert.alert("Igreja atual", `Você está entrando na igreja: ${tenant.name}`);
      router.replace("/(tabs)");
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      Alert.alert("Erro", message);
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
          <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="member-register-back">
            <ArrowLeft color={colors.primary} size={18} strokeWidth={2.4} />
            <Text style={styles.backText}>Voltar</Text>
          </TouchableOpacity>

          <View style={styles.brandMark}>
            <UserPlus color={colors.surface} size={26} strokeWidth={2.6} />
          </View>
          <Text style={styles.title}>Cadastro de membro</Text>
          <Text style={styles.subtitle}>Use o link ou código fornecido pela sua igreja.</Text>

          {error ? (
            <Text style={styles.error} accessibilityRole="alert" testID="member-register-error">
              {error}
            </Text>
          ) : null}

          <Text style={styles.label}>Código de convite *</Text>
          <View style={styles.inputGroup}>
            <LinkIcon color={colors.muted} size={18} strokeWidth={2.2} />
            <TextInput
              style={styles.groupInput}
              placeholder="Código do convite"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              value={inviteCode}
              onChangeText={(value) => {
                setInviteCode(value);
                setError(null);
              }}
              testID="member-register-code"
            />
          </View>

          <Text style={styles.label}>Nome *</Text>
          <TextInput
            style={styles.input}
            placeholder="Nome completo"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
            testID="member-register-name"
          />

          <Text style={styles.label}>E-mail *</Text>
          <TextInput
            style={styles.input}
            placeholder="voce@email.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            testID="member-register-email"
          />

          <Text style={styles.label}>Telefone</Text>
          <TextInput
            style={styles.input}
            placeholder="(00) 00000-0000"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            testID="member-register-phone"
          />

          <Text style={styles.label}>Senha *</Text>
          <TextInput
            style={styles.input}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor={colors.muted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            testID="member-register-password"
          />

          <Text style={styles.label}>Confirmar senha *</Text>
          <TextInput
            style={styles.input}
            placeholder="Repita a senha"
            placeholderTextColor={colors.muted}
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
            testID="member-register-confirm"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            testID="member-register-submit"
          >
            {loading ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.buttonText}>Cadastrar como membro</Text>
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
  title: { fontSize: 32, fontWeight: "800", color: colors.ink, marginBottom: spacing.xs },
  subtitle: { fontSize: 15, lineHeight: 22, color: colors.muted, marginBottom: spacing.xl },
  error: {
    backgroundColor: "#FDECEC",
    borderColor: "#F0B8B8",
    borderWidth: 1,
    borderRadius: radii.sm,
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
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
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  groupInput: {
    flex: 1,
    paddingVertical: 14,
    paddingLeft: spacing.md,
    color: colors.ink,
    fontSize: 15,
  },
  button: {
    minHeight: 52,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.surface, fontSize: 16, fontWeight: "700" },
});
