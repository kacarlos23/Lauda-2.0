import React, { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../src/services/api";
import { colors, radii, spacing } from "../../src/theme";

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
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Redefinir Senha</Text>
        <Text style={styles.subtitle}>Insira o código PIN enviado para {email} e sua nova senha.</Text>
      </View>

      <View style={styles.form}>
        <View>
          <Text style={styles.label}>Código PIN (6 dígitos)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 123456"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            maxLength={6}
            value={pin}
            onChangeText={setPin}
          />
        </View>

        <View>
          <Text style={styles.label}>Nova Senha</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite a nova senha"
            placeholderTextColor={colors.muted}
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
        </View>

        <View>
          <Text style={styles.label}>Confirmar Senha</Text>
          <TextInput
            style={styles.input}
            placeholder="Confirme a nova senha"
            placeholderTextColor={colors.muted}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.disabled]}
          onPress={handleResetPassword}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryText}>Redefinir</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.replace("/(auth)/login")}
          disabled={loading}
        >
          <Text style={styles.secondaryText}>Cancelar</Text>
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
    marginTop: spacing.md,
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
