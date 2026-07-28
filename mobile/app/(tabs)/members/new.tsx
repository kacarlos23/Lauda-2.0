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
import {
  colors,
  controlSizes,
  fontSizes,
  fontWeights,
  iconSizes,
  lineHeights,
  radii,
  radiusValues,
  screen,
  spacing,
} from "../../../src/theme";
import { AppBackButton } from "../../../src/components/AppBackButton";
import { goBackTo } from "../../../src/utils/navigation";
import { canManageMembers } from "../../../src/utils/permissions";
import { RichCommentEditor } from "../../../src/components/ui/RichCommentEditor";
import { GROUP_HREFS, nav } from "../../../src/navigation/routes";

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
  comments: "",
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
    return <Redirect href={GROUP_HREFS.tabs} />;
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
    if (loading) return;

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
        comments: form.comments || null,
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
          <View style={styles.back}><AppBackButton href={nav.members} /></View>

          <View style={styles.brandMark}>
            <UserPlus color={colors.surface} size={iconSizes.s26} strokeWidth={2.6} />
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
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
            onSubmitEditing={() => void handleSubmit()}
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
                  {!form.ministryId ? <Check color={colors.primary} size={iconSizes.s18} /> : null}
                </TouchableOpacity>
                {ministries.map((ministry) => (
                  <TouchableOpacity
                    key={ministry.id}
                    style={[styles.ministryOption, form.ministryId === ministry.id && styles.ministryOptionActive]}
                    onPress={() => setField("ministryId", ministry.id)}
                  >
                    <Text style={styles.ministryOptionText}>{ministry.name}</Text>
                    {form.ministryId === ministry.id ? <Check color={colors.primary} size={iconSizes.s18} /> : null}
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
                {form.isLeader ? <Check color={colors.surface} size={iconSizes.s14} strokeWidth={3} /> : null}
              </View>
              <Text style={styles.checkboxText}>Marcar como líder deste ministério</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.commentsEditor}><RichCommentEditor value={form.comments} onChange={(value) => setField("comments", value)} label="Comentários" placeholder="Observações administrativas ou pastorais sobre este membro..." testID="member-comments-input" /></View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <>
                <Save color={colors.surface} size={iconSizes.s18} strokeWidth={2.4} />
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
  commentsEditor: { marginTop: spacing.lg },
  container: { flex: 1, backgroundColor: colors.background },
  scroll: {
    flexGrow: 1,
    padding: spacing.xl,
    paddingBottom: screen.contentBottomPadding,
  },
  inner: {
    width: "100%",
    maxWidth: screen.formMaxWidth,
    alignSelf: "center",
    paddingVertical: spacing.lg,
  },
  back: {
    marginBottom: spacing.lg,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  backText: { color: colors.primary, fontSize: fontSizes.s15, fontWeight: fontWeights.bold },
  brandMark: {
    width: controlSizes.default,
    height: controlSizes.default,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: { fontSize: fontSizes.s32, fontWeight: fontWeights.extrabold, color: colors.ink, marginBottom: spacing.xs },
  subtitle: { fontSize: fontSizes.s15, lineHeight: lineHeights.h22, color: colors.muted, marginBottom: spacing.lg, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  label: { color: colors.text, fontSize: fontSizes.s13, fontWeight: fontWeights.bold, marginBottom: spacing.sm },
  input: {
    minHeight: controlSizes.default,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.control,
    paddingHorizontal: spacing.lg,
    color: colors.ink,
    fontSize: fontSizes.s15,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  error: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radii.md,
    color: colors.danger,
    fontSize: fontSizes.s14,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.h20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  success: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radii.md,
    color: colors.primaryDark,
    fontSize: fontSizes.s14,
    fontWeight: fontWeights.extrabold,
    lineHeight: lineHeights.h20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.md,
  },
  segmentButton: {
    flex: 1,
    minHeight: controlSizes.default,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentButtonActive: { backgroundColor: colors.surface },
  segmentText: { color: colors.muted, fontSize: fontSizes.s14, fontWeight: fontWeights.extrabold },
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
  ministryOptionText: { flex: 1, color: colors.text, fontSize: fontSizes.s14, fontWeight: fontWeights.bold },
  mutedText: { color: colors.muted, fontSize: fontSizes.s14, padding: spacing.lg },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radiusValues.r6,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxText: { flex: 1, color: colors.text, fontSize: fontSizes.s14, fontWeight: fontWeights.bold },
  button: {
    minHeight: controlSizes.default,
    backgroundColor: colors.primary,
    paddingVertical: spacing.control,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.surface, fontSize: fontSizes.s16, fontWeight: fontWeights.bold },
});
