import { useEffect, useState } from "react";
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
import { Redirect, useRouter } from "expo-router";
import { Check, Save, UserPlus } from "lucide-react-native";
import { memberService } from "../../../src/services/memberService";
import { ministryApi } from "../../../src/services/ministryApi";
import { useAuthStore } from "../../../src/store/authStore";
import { Ministry, Role } from "../../../src/types";
import { colors, radii, screen, shadow, spacing } from "../../../src/theme";
import { AppBackButton } from "../../../src/components/AppBackButton";
import { goBackTo } from "../../../src/utils/navigation";
import { canManageMembers } from "../../../src/utils/permissions";

type ManagedRole = Extract<Role, "MEMBER" | "MINISTRY_LEADER">;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  role: "MEMBER" as ManagedRole,
  ministryId: "",
  isLeader: false,
};

export default function NewMemberScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [form, setForm] = useState(emptyForm);
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [loading, setLoading] = useState(false);
  const [ministriesLoading, setMinistriesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    ministryApi
      .getMinistries()
      .then(setMinistries)
      .catch(() => setMinistries([]))
      .finally(() => setMinistriesLoading(false));
  }, []);

  if (!canManageMembers(user)) {
    return <Redirect href="/(tabs)" />;
  }

  const setField = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError(null);
    setSuccess(null);
  };

  const validate = () => {
    if (!form.name.trim()) return "Informe o nome do membro.";
    if (!isValidEmail(form.email.trim().toLowerCase())) return "Informe um e-mail válido.";
    if (form.password.length < 6) return "A senha provisória deve ter ao menos 6 caracteres.";
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const member = await memberService.createMember({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        role: form.role,
      });

      if (form.ministryId) {
        await memberService.addMinistry(member.id, {
          ministryId: form.ministryId,
          isLeader: form.isLeader,
        });
      }

      setForm(emptyForm);
      setSuccess("Membro cadastrado com sucesso.");
      Alert.alert("Sucesso", "Membro cadastrado com sucesso.", [
        { text: "Cadastrar outro" },
        { text: "Ver membros", onPress: () => goBackTo(router, "/members") },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar membro.");
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
          <View style={styles.back}><AppBackButton href="/members" /></View>

          <View style={styles.brandMark}>
            <UserPlus color={colors.surface} size={26} strokeWidth={2.6} />
          </View>
          <Text style={styles.title}>Novo membro</Text>
          <Text style={styles.subtitle}>Cadastre o acesso de uma pessoa da igreja.</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? <Text style={styles.success}>{success}</Text> : null}

          <Text style={styles.label}>Nome *</Text>
          <TextInput
            style={styles.input}
            placeholder="Nome completo"
            placeholderTextColor={colors.muted}
            value={form.name}
            onChangeText={(value) => setField("name", value)}
          />

          <Text style={styles.label}>E-mail *</Text>
          <TextInput
            style={styles.input}
            placeholder="membro@suaigreja.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={form.email}
            onChangeText={(value) => setField("email", value)}
          />

          <Text style={styles.label}>Telefone</Text>
          <TextInput
            style={styles.input}
            placeholder="(00) 00000-0000"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            value={form.phone}
            onChangeText={(value) => setField("phone", value)}
          />

          <Text style={styles.label}>Senha provisória *</Text>
          <TextInput
            style={styles.input}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor={colors.muted}
            secureTextEntry
            value={form.password}
            onChangeText={(value) => setField("password", value)}
          />

          <Text style={styles.label}>Tipo de usuário</Text>
          <View style={styles.segment}>
            {(["MEMBER", "MINISTRY_LEADER"] as ManagedRole[]).map((role) => {
              const selected = form.role === role;
              return (
                <TouchableOpacity
                  key={role}
                  style={[styles.segmentButton, selected && styles.segmentButtonActive]}
                  onPress={() => setField("role", role)}
                >
                  <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>
                    {role === "MEMBER" ? "Membro" : "Líder"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Ministério vinculado</Text>
          <View style={styles.ministryBox}>
            {ministriesLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : ministries.length === 0 ? (
              <Text style={styles.mutedText}>Nenhum ministério cadastrado.</Text>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.ministryOption, !form.ministryId && styles.ministryOptionActive]}
                  onPress={() => setField("ministryId", "")}
                >
                  <Text style={styles.ministryOptionText}>Sem vínculo inicial</Text>
                  {!form.ministryId ? <Check color={colors.primary} size={18} /> : null}
                </TouchableOpacity>
                {ministries.map((ministry) => (
                  <TouchableOpacity
                    key={ministry.id}
                    style={[styles.ministryOption, form.ministryId === ministry.id && styles.ministryOptionActive]}
                    onPress={() => setField("ministryId", ministry.id)}
                  >
                    <Text style={styles.ministryOptionText}>{ministry.name}</Text>
                    {form.ministryId === ministry.id ? <Check color={colors.primary} size={18} /> : null}
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>

          {form.ministryId ? (
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setField("isLeader", !form.isLeader)}
            >
              <View style={[styles.checkbox, form.isLeader && styles.checkboxActive]}>
                {form.isLeader ? <Check color={colors.surface} size={14} strokeWidth={3} /> : null}
              </View>
              <Text style={styles.checkboxText}>Marcar como líder deste ministério</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <>
                <Save color={colors.surface} size={18} strokeWidth={2.4} />
                <Text style={styles.buttonText}>Cadastrar membro</Text>
              </>
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
    borderRadius: radii.xl,
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
  label: { color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    color: colors.ink,
    fontSize: 15,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  error: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radii.md,
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  success: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radii.md,
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.lg,
  },
  segmentButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentButtonActive: { backgroundColor: colors.surface },
  segmentText: { color: colors.muted, fontSize: 14, fontWeight: "800" },
  segmentTextActive: { color: colors.primary },
  ministryBox: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.lg,
    overflow: "hidden",
  },
  ministryOption: {
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  ministryOptionActive: { backgroundColor: colors.surface },
  ministryOptionText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "700" },
  mutedText: { color: colors.muted, fontSize: 14, padding: spacing.lg },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "700" },
  button: {
    minHeight: 52,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.surface, fontSize: 16, fontWeight: "700" },
});
