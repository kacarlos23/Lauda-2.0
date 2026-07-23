import React, { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, KeyRound, Lock } from "lucide-react-native";
import { api } from "../../src/services/api";
import { AuthShell } from "../../src/components/AuthShell";
import { AppInput, Button } from "../../src/components/ui";
import { colors, spacing, typography } from "../../src/theme";

export default function ResetPasswordScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [pin, setPin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleResetPassword = async () => {
    if (!pin.trim() || pin.length !== 6) {
      Alert.alert("Erro", "O PIN deve conter exatamente 6 dígitos.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Erro", "A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Erro", "As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        email,
        token: pin,
        newPassword,
      });
      Alert.alert("Sucesso", "Sua senha foi redefinida com sucesso.");
      router.replace("/(auth)/login");
    } catch (error: any) {
      const message = error.response?.data?.error || "Erro ao redefinir a senha.";
      Alert.alert("Erro", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      overline="Nova credencial"
      title="Defina uma nova senha"
      subtitle={`Insira o código enviado para ${email ?? "seu e-mail"} e escolha a nova senha.`}
    >
      <View style={styles.fields}>
        <AppInput
          label="Código PIN (6 dígitos)"
          icon={<KeyRound color={colors.muted} size={18} strokeWidth={2} />}
          placeholder="123456"
          keyboardType="number-pad"
          maxLength={6}
          value={pin}
          onChangeText={setPin}
          accessibilityLabel="Código PIN de 6 dígitos"
        />

        <AppInput
          label="Nova senha"
          icon={<Lock color={colors.muted} size={18} strokeWidth={2} />}
          placeholder="Mínimo de 6 caracteres"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
          accessibilityLabel="Nova senha"
        />

        <AppInput
          label="Confirmar senha"
          icon={<Lock color={colors.muted} size={18} strokeWidth={2} />}
          placeholder="Repita a nova senha"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          accessibilityLabel="Confirmar nova senha"
        />
      </View>

      <Button
        title="Atualizar senha"
        loading={loading}
        onPress={handleResetPassword}
        style={styles.primaryButton}
        accessibilityLabel="Atualizar senha"
      />

      <TouchableOpacity
        style={styles.back}
        onPress={() => router.replace("/(auth)/login")}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Cancelar e voltar ao login"
      >
        <ArrowLeft color={colors.primary} size={18} strokeWidth={2.2} />
        <Text style={styles.backText}>Cancelar e voltar ao login</Text>
      </TouchableOpacity>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  fields: {
    gap: spacing.md,
  },
  primaryButton: {
    marginTop: spacing.xl,
  },
  back: {
    minHeight: 44,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  backText: {
    ...typography.label,
    color: colors.primary,
  },
});
