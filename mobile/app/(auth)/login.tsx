import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Lock, LogIn, Mail } from "lucide-react-native";
import { AxiosError } from "axios";
import { useAuthStore } from "../../src/store/authStore";
import { AuthShell } from "../../src/components/AuthShell";
import { AppInput, Button, ErrorBanner } from "../../src/components/ui";
import { colors, controlSizes, iconSizes, spacing, typography } from "../../src/theme";
import { GROUP_HREFS, nav } from "../../src/navigation/routes";

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
      router.replace(GROUP_HREFS.tabs);
    } catch (err) {
      setLocalError(getErrorMessage(err));
    }
  };

  return (
    <AuthShell
      overline="Acesso à sua igreja"
      title="Boas-vindas de volta"
      subtitle="Entre para acompanhar escalas, repertório e sua equipe."
    >
      <ErrorBanner message={currentError} style={styles.error} testID="login-error" />

      <View style={styles.fields}>
        <AppInput
          label="E-mail"
          icon={<Mail color={colors.muted} size={iconSizes.s18} strokeWidth={2} />}
          placeholder="voce@igreja.com"
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

        <AppInput
          label="Senha"
          icon={<Lock color={colors.muted} size={iconSizes.s18} strokeWidth={2} />}
          placeholder="Sua senha"
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
        style={styles.forgotPasswordLink}
        onPress={() => router.push(nav.forgotPassword)}
        accessibilityLabel="Esqueci minha senha"
        accessibilityRole="button"
        testID="forgot-password"
      >
        <Text style={styles.linkText}>Esqueci minha senha</Text>
      </TouchableOpacity>

      <Button
        title="Entrar"
        icon={<LogIn color={colors.inverse} size={iconSizes.s18} strokeWidth={2.2} />}
        loading={loading}
        style={styles.button}
        onPress={handleLogin}
        accessibilityLabel="Entrar"
        testID="login-submit"
      />

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>Outras formas de acesso</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity
        style={styles.secondaryLink}
        onPress={() => router.push(nav.memberRegister)}
        accessibilityLabel="Cadastrar como membro"
        accessibilityRole="button"
        testID="go-member-register"
      >
        <Text style={styles.secondaryText}>
          Recebeu um convite? <Text style={styles.linkText}>Cadastre-se como membro</Text>
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryLink}
        onPress={() => router.push(nav.register)}
        accessibilityLabel="Cadastrar igreja"
        accessibilityRole="button"
        testID="go-register"
      >
        <Text style={styles.secondaryText}>
          Sua igreja ainda não usa o Lauda? <Text style={styles.linkText}>Criar conta</Text>
        </Text>
      </TouchableOpacity>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  error: {
    marginBottom: spacing.lg,
  },
  fields: {
    gap: spacing.md,
  },
  forgotPasswordLink: {
    minHeight: controlSizes.default,
    alignSelf: "flex-end",
    justifyContent: "center",
  },
  button: {
    marginTop: spacing.sm,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginVertical: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.line,
  },
  dividerText: {
    ...typography.metadata,
    color: colors.muted,
  },
  secondaryLink: {
    minHeight: controlSizes.default,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  secondaryText: {
    ...typography.metadata,
    color: colors.muted,
  },
  linkText: {
    ...typography.label,
    color: colors.primary,
  },
});
