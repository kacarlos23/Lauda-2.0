import React, { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Mail } from "lucide-react-native";
import { api } from "../../src/services/api";
import { AuthShell } from "../../src/components/AuthShell";
import { AppInput, Button, ErrorBanner } from "../../src/components/ui";
import { colors, controlSizes, iconSizes, spacing, typography } from "../../src/theme";
import { goBackTo } from "../../src/utils/navigation";
import { GROUP_HREFS, nav } from "../../src/navigation/routes";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleForgotPassword = async () => {
    if (loading) return;

    if (!email.trim()) {
      const message = "Por favor, insira seu e-mail.";
      setError(message);
      Alert.alert("Erro", message);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.post("/auth/forgot-password", { email: email.trim().toLowerCase() });
      Alert.alert("Sucesso", "Se o e-mail existir, um código foi enviado.");
      router.push({ pathname: nav.resetPassword, params: { email: email.trim().toLowerCase() } });
    } catch (caught: any) {
      const message = caught?.response?.data?.error || "Erro ao solicitar recuperação de senha.";
      setError(message);
      Alert.alert("Erro", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      overline="Recuperação de acesso"
      title="Recupere seu acesso"
      subtitle="Informe seu e-mail para receber o código PIN de recuperação."
    >
      <ErrorBanner message={error} style={styles.errorBanner} />

      <AppInput
        label="E-mail"
        icon={<Mail color={colors.muted} size={iconSizes.s18} strokeWidth={2} />}
        placeholder="voce@igreja.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          if (error) setError(null);
        }}
        returnKeyType="send"
        submitBehavior="blurAndSubmit"
        onSubmitEditing={() => void handleForgotPassword()}
        accessibilityLabel="E-mail"
      />

      <Button
        title="Enviar código"
        loading={loading}
        onPress={handleForgotPassword}
        style={styles.primaryButton}
        accessibilityLabel="Enviar código"
      />

      <TouchableOpacity
        style={styles.back}
        onPress={() => goBackTo(router, GROUP_HREFS.auth)}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Voltar para o login"
      >
        <ArrowLeft color={colors.primary} size={iconSizes.s18} strokeWidth={2.2} />
        <Text style={styles.backText}>Voltar para o login</Text>
      </TouchableOpacity>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  errorBanner: {
    marginBottom: spacing.md,
  },
  primaryButton: {
    marginTop: spacing.xl,
  },
  back: {
    minHeight: controlSizes.default,
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
