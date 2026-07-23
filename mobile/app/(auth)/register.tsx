import { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Building2, Lock, Mail, UserRound } from "lucide-react-native";
import { goBackTo } from "../../src/utils/navigation";
import { useAuthStore } from "../../src/store/authStore";
import { AuthShell } from "../../src/components/AuthShell";
import { AppInput, Button } from "../../src/components/ui";
import { colors, spacing, typography } from "../../src/theme";

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
    <AuthShell
      overline="Primeiros passos"
      title="Crie sua igreja"
      subtitle="Configure a instituição e o primeiro administrador."
      width="wide"
    >
      <TouchableOpacity
        onPress={() => goBackTo(router, "/(auth)/login")}
        style={styles.back}
        accessibilityRole="button"
        accessibilityLabel="Voltar para o login"
        testID="register-back"
      >
        <ArrowLeft color={colors.primary} size={18} strokeWidth={2.2} />
        <Text style={styles.backText}>Voltar</Text>
      </TouchableOpacity>

      <View style={styles.fields}>
        <AppInput
          label="Nome da igreja *"
          icon={<Building2 color={colors.muted} size={18} strokeWidth={2} />}
          placeholder="Ex.: Igreja Batista Central"
          value={churchName}
          onChangeText={setChurchName}
          accessibilityLabel="Nome da igreja"
          testID="register-church"
        />

        <View style={styles.fieldRow}>
          <AppInput
            label="Seu nome *"
            icon={<UserRound color={colors.muted} size={18} strokeWidth={2} />}
            placeholder="Nome completo"
            value={name}
            onChangeText={setName}
            accessibilityLabel="Seu nome"
            testID="register-name"
            containerStyle={styles.rowField}
          />

          <AppInput
            label="E-mail *"
            icon={<Mail color={colors.muted} size={18} strokeWidth={2} />}
            placeholder="admin@suaigreja.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            accessibilityLabel="E-mail"
            testID="register-email"
            containerStyle={styles.rowField}
          />
        </View>

        <View style={styles.fieldRow}>
          <AppInput
            label="Senha *"
            icon={<Lock color={colors.muted} size={18} strokeWidth={2} />}
            placeholder="Mínimo de 6 caracteres"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            accessibilityLabel="Senha"
            testID="register-password"
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
            testID="register-confirm"
            containerStyle={styles.rowField}
          />
        </View>
      </View>

      <Button
        title="Criar conta"
        loading={loading}
        onPress={handleRegister}
        style={styles.button}
        accessibilityLabel="Criar conta"
        testID="register-submit"
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
