import React, { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../src/services/api";
import { colors, radii, spacing } from "../../src/theme";
import { goBackTo } from "../../src/utils/navigation";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert("Erro", "Por favor, insira seu e-mail.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      Alert.alert("Sucesso", "Se o e-mail existir, um código foi enviado.");
      router.push({ pathname: "/(auth)/reset-password", params: { email } });
    } catch (error: any) {
      const message = error.response?.data?.error || "Erro ao solicitar recuperação de senha.";
      Alert.alert("Erro", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Recuperar Senha</Text>
        <Text style={styles.subtitle}>Insira seu e-mail para receber o código PIN de recuperação.</Text>
      </View>

      <View style={styles.form}>
        <View>
          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite seu e-mail"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.disabled]}
          onPress={handleForgotPassword}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryText}>Enviar código</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => goBackTo(router, "/(auth)/login")}
          disabled={loading}
        >
          <Text style={styles.secondaryText}>Voltar para o login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "800",
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
  },
  form: {
    gap: spacing.lg,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  input: {
    minHeight: 56,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background,
    color: colors.ink,
    paddingHorizontal: spacing.xl,
    fontSize: 15,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: colors.surface,
    fontSize: 17,
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.7,
  },
});
