import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Link as LinkIcon, Lock, Mail, Phone, UserRound } from "lucide-react-native";
import { AxiosError } from "axios";
import { useAuthStore } from "../../src/store/authStore";
import { AuthShell } from "../../src/components/AuthShell";
import { AppInput, Button, ErrorBanner } from "../../src/components/ui";
import { colors, spacing, typography } from "../../src/theme";
import { normalizeInviteCode } from "../../src/utils/memberInvite";
import { goBackTo } from "../../src/utils/navigation";

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
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const { memberRegister } = useAuthStore();

  const [inviteCode, setInviteCode] = useState(String(params.code ?? ""));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = Array.isArray(params.code) ? params.code[0] : params.code;
    if (code) {
      setInviteCode(normalizeInviteCode(String(code)));
      setError(null);
    }
  }, [params.code]);

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = normalizeInviteCode(inviteCode);

    if (!normalizedCode) {
      setError("Informe o código de convite.");
      return;
    }

    if (name.trim().length < 2) {
      setError("Informe seu nome.");
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setError("Informe um e-mail válido.");
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
      await memberRegister({
        inviteCode: normalizedCode,
        name: name.trim(),
        email: normalizedEmail,
        phone: phone.trim() || undefined,
        password,
      });
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
    <AuthShell
      overline="Convite para a equipe"
      title="Entre para a equipe"
      subtitle="Use o link ou o código fornecido pela sua igreja."
      width="wide"
    >
      <TouchableOpacity
        onPress={() => goBackTo(router, "/(auth)/login")}
        style={styles.back}
        accessibilityRole="button"
        accessibilityLabel="Voltar para o login"
        testID="member-register-back"
      >
        <ArrowLeft color={colors.primary} size={18} strokeWidth={2.2} />
        <Text style={styles.backText}>Voltar</Text>
      </TouchableOpacity>

      <ErrorBanner message={error} style={styles.error} testID="member-register-error" />

      <View style={styles.fields}>
        <AppInput
          label="Código de convite *"
          icon={<LinkIcon color={colors.muted} size={18} strokeWidth={2} />}
          placeholder="Código do convite"
          autoCapitalize="characters"
          value={inviteCode}
          onChangeText={(value) => {
            setInviteCode(value);
            setError(null);
          }}
          accessibilityLabel="Código de convite"
          testID="member-register-code"
        />

        <View style={styles.fieldRow}>
          <AppInput
            label="Nome *"
            icon={<UserRound color={colors.muted} size={18} strokeWidth={2} />}
            placeholder="Nome completo"
            value={name}
            onChangeText={setName}
            accessibilityLabel="Nome"
            testID="member-register-name"
            containerStyle={styles.rowField}
          />

          <AppInput
            label="Telefone"
            icon={<Phone color={colors.muted} size={18} strokeWidth={2} />}
            placeholder="(00) 00000-0000"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            accessibilityLabel="Telefone"
            testID="member-register-phone"
            containerStyle={styles.rowField}
          />
        </View>

        <AppInput
          label="E-mail *"
          icon={<Mail color={colors.muted} size={18} strokeWidth={2} />}
          placeholder="voce@email.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          accessibilityLabel="E-mail"
          testID="member-register-email"
        />

        <View style={styles.fieldRow}>
          <AppInput
            label="Senha *"
            icon={<Lock color={colors.muted} size={18} strokeWidth={2} />}
            placeholder="Mínimo de 6 caracteres"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            accessibilityLabel="Senha"
            testID="member-register-password"
            containerStyle={styles.rowField}
          />

          <AppInput
            label="Confirmar senha *"
            icon={<Lock color={colors.muted} size={18} strokeWidth={2} />}
            placeholder="Repita a senha"
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
            accessibilityLabel="Confirmar senha"
            testID="member-register-confirm"
            containerStyle={styles.rowField}
          />
        </View>
      </View>

      <Button
        title="Cadastrar como membro"
        loading={loading}
        onPress={handleSubmit}
        style={styles.button}
        accessibilityLabel="Cadastrar como membro"
        testID="member-register-submit"
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  back: {
    minHeight: 44,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  backText: { ...typography.label, color: colors.primary },
  error: {
    marginBottom: spacing.lg,
  },
  fields: {
    gap: spacing.md,
  },
  fieldRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  rowField: {
    flex: 1,
    minWidth: 240,
  },
  button: {
    marginTop: spacing.xl,
  },
});
