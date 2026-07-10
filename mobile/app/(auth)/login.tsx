import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Lock, LogIn, Mail } from "lucide-react-native";
import { AxiosError } from "axios";
import { useAuthStore } from "../../src/store/authStore";
import { AppInput, Button, Card, ErrorBanner } from "../../src/components/ui";
import { colors, radii, screen, spacing, typography } from "../../src/theme";

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
      <Card style={styles.inner}>
        <View style={styles.brandMark}>
          <LogIn color={colors.surface} size={26} strokeWidth={2.6} />
        </View>
        <Text style={styles.title}>Lauda</Text>
        <Text style={styles.subtitle}>Gestão simples para ministérios, escalas e equipes.</Text>

        <ErrorBanner message={currentError} style={styles.error} testID="login-error" />

        <AppInput
          label="E-mail"
          icon={<Mail color={colors.muted} size={18} strokeWidth={2.2} />}
          placeholder="E-mail"
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
          containerStyle={styles.field}
        />

        <AppInput
          label="Senha"
          icon={<Lock color={colors.muted} size={18} strokeWidth={2.2} />}
          placeholder="Senha"
          secureTextEntry
          textContentType="password"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setLocalError(null);
          }}
          accessibilityLabel="Senha"
          testID="login-password"
          containerStyle={styles.field}
        />

        <Button
          title="Entrar"
          icon={<LogIn color={colors.surface} size={18} strokeWidth={2.4} />}
          loading={loading}
          size="lg"
          style={styles.button}
          onPress={handleLogin}
          accessibilityLabel="Entrar"
          testID="login-submit"
        />

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
          style={styles.memberRegisterLink}
          onPress={() => router.push("/(auth)/member-register")}
          accessibilityLabel="Cadastrar como membro"
          accessibilityRole="button"
          testID="go-member-register"
        >
          <Text style={styles.registerText}>
            Sou membro? <Text style={styles.registerHighlight}>Cadastre-se com link</Text>
          </Text>
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
      </Card>
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
    padding: spacing.xl,
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
    ...typography.heroTitle,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.subtitle,
    color: colors.muted,
    marginBottom: spacing.xl,
  },
  error: {
    marginBottom: spacing.lg,
  },
  field: { marginBottom: spacing.lg },
  button: {
    marginTop: spacing.sm,
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
    ...typography.label,
  },
  memberRegisterLink: {
    marginTop: spacing.lg,
    alignItems: "center",
  },
  registerText: {
    ...typography.metadata,
    color: colors.muted,
    textAlign: "center",
  },
  registerHighlight: {
    color: colors.primary,
    fontWeight: typography.label.fontWeight,
  },
});
