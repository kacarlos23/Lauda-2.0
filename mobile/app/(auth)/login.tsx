import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Lock, LogIn, Mail } from "lucide-react-native";
import { AxiosError } from "axios";
import { useAuthStore } from "../../src/store/authStore";
import { colors, radii, screen, shadow, spacing } from "../../src/theme";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { error?: string } | undefined;
    return data?.error ?? "Erro ao fazer login. Tente novamente.";
  }

  return "Erro ao fazer login. Tente novamente.";
}

export default function LoginScreen() {
  const { login, loading, error } = useAuthStore();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const currentError = localError ?? error;

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      setLocalError("Informe um e-mail válido.");
      return;
    }

    if (password.length < 6) {
      setLocalError("A senha deve ter ao menos 6 caracteres.");
      return;
    }

    setLocalError(null);

    try {
      await login(normalizedEmail, password);
      router.replace("/(tabs)");
    } catch (err) {
      setLocalError(getErrorMessage(err));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <View style={styles.brandMark}>
          <LogIn color={colors.surface} size={26} strokeWidth={2.6} />
        </View>
        <Text style={styles.title}>Lauda</Text>
        <Text style={styles.subtitle}>Gestão simples para ministérios, escalas e equipes.</Text>

        {currentError ? (
          <Text style={styles.error} accessibilityRole="alert" testID="login-error">
            {currentError}
          </Text>
        ) : null}

        <Text style={styles.label}>E-mail</Text>
        <View style={styles.inputGroup}>
          <Mail color={colors.muted} size={18} strokeWidth={2.2} />
          <TextInput
            style={styles.input}
            placeholder="E-mail"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setLocalError(null);
            }}
            accessibilityLabel="E-mail"
            testID="login-email"
          />
        </View>

        <Text style={styles.label}>Senha</Text>
        <View style={styles.inputGroup}>
          <Lock color={colors.muted} size={18} strokeWidth={2.2} />
          <TextInput
            style={styles.input}
            placeholder="Senha"
            placeholderTextColor={colors.muted}
            secureTextEntry
            textContentType="password"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setLocalError(null);
            }}
            accessibilityLabel="Senha"
            testID="login-password"
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          accessibilityLabel="Entrar"
          accessibilityRole="button"
          testID="login-submit"
        >
          {loading ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <>
              <LogIn color={colors.surface} size={18} strokeWidth={2.4} />
              <Text style={styles.buttonText}>Entrar</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.forgotPasswordLink}
          onPress={() => router.push("/(auth)/forgot-password")}
          accessibilityLabel="Esqueci minha senha"
          accessibilityRole="button"
          testID="forgot-password"
        >
          <Text style={styles.forgotPasswordText}>Esqueci minha senha</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.registerLink}
          onPress={() => router.push("/(auth)/register")}
          accessibilityLabel="Cadastrar igreja"
          accessibilityRole="button"
          testID="go-register"
        >
          <Text style={styles.registerText}>
            Não tem conta? <Text style={styles.registerHighlight}>Cadastre sua igreja</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    fontSize: 34,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
    marginBottom: spacing.xl,
  },
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
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: spacing.sm,
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
  input: {
    flex: 1,
    paddingVertical: 15,
    paddingLeft: spacing.md,
    color: colors.ink,
    fontSize: 16,
  },
  button: {
    minHeight: 52,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: "700",
  },
  registerLink: {
    marginTop: spacing.xl,
    alignItems: "center",
  },
  forgotPasswordLink: {
    marginTop: spacing.md,
    alignItems: "center",
  },
  forgotPasswordText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  registerText: {
    color: colors.muted,
    fontSize: 14,
    textAlign: "center",
  },
  registerHighlight: {
    color: colors.primary,
    fontWeight: "700",
  },
});
