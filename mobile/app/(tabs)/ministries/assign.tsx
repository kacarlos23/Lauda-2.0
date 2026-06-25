import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { ministryApi } from "../../../src/services/ministryApi";
import { useAuthStore } from "../../../src/store/authStore";
import { MemberStatus, Ministry } from "../../../src/types";
import { colors, radii, spacing } from "../../../src/theme";
import { AppBackButton } from "../../../src/components/AppBackButton";
import { goBackTo } from "../../../src/utils/navigation";

const statuses: MemberStatus[] = ["ACTIVE", "INACTIVE"];

function canAssign(role?: string): boolean {
  return role === "GLOBAL_ADMIN" || role === "TENANT_ADMIN" || role === "MINISTRY_LEADER";
}

export default function AssignMemberScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ministryId?: string }>();
  const { user } = useAuthStore();
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [ministryId, setMinistryId] = useState(params.ministryId ?? "");
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<MemberStatus>("ACTIVE");
  const [isLeader, setIsLeader] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadMinistries = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ministryApi.getMinistries();
      setMinistries(data);
      if (!ministryId && data[0]) setMinistryId(data[0].id);
    } catch (error) {
      Alert.alert("Erro", error instanceof Error ? error.message : "Não foi possível carregar ministérios.");
    } finally {
      setLoading(false);
    }
  }, [ministryId]);

  useEffect(() => {
    loadMinistries();
  }, [loadMinistries]);

  const handleSubmit = async () => {
    const skills = skillsText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!ministryId || !userId.trim()) {
      Alert.alert("Dados obrigatórios", "Informe o ministério e o ID do usuário.");
      return;
    }

    try {
      setSubmitting(true);
      await ministryApi.assignMember({
        ministryId,
        userId: userId.trim(),
        role: role.trim() || undefined,
        skills,
        status,
        notes: notes.trim() || undefined,
        isLeader,
      });
      Alert.alert("Membro atribuído", "A atribuição foi criada com sucesso.", [
        { text: "OK", onPress: () => goBackTo(router, ministryId ? `/ministries/${ministryId}/members` : "/ministries") },
      ]);
    } catch (error) {
      Alert.alert("Erro", error instanceof Error ? error.message : "Não foi possível atribuir o membro.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!canAssign(user?.role)) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Você não tem permissão para atribuir membros.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <AppBackButton href={ministryId ? `/ministries/${ministryId}/members` : "/ministries"} compact />
          <Text style={styles.title}>Atribuir membro</Text>
        </View>

        {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}

        <Text style={styles.label}>Ministério</Text>
        <View style={styles.chips}>
          {ministries.map((ministry) => (
            <TouchableOpacity
              key={ministry.id}
              style={[styles.chip, ministryId === ministry.id && styles.chipActive]}
              onPress={() => setMinistryId(ministry.id)}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, ministryId === ministry.id && styles.chipTextActive]}>{ministry.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>ID do usuário *</Text>
        <TextInput
          style={styles.input}
          value={userId}
          onChangeText={setUserId}
          placeholder="UUID do usuário"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Cargo</Text>
        <TextInput
          style={styles.input}
          value={role}
          onChangeText={setRole}
          placeholder="Ex: Vocalista"
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>Habilidades</Text>
        <TextInput
          style={styles.input}
          value={skillsText}
          onChangeText={setSkillsText}
          placeholder="violão, vocal, bateria"
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>Situação no ministério</Text>
        <View style={styles.chips}>
          {statuses.map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.chip, status === item && styles.chipActive]}
              onPress={() => setStatus(item)}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, status === item && styles.chipTextActive]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.toggleRow} onPress={() => setIsLeader((value) => !value)} accessibilityRole="button">
          <View style={[styles.checkbox, isLeader && styles.checkboxActive]}>
            {isLeader ? <Check color={colors.surface} size={16} /> : null}
          </View>
          <Text style={styles.toggleText}>Marcar como líder do ministério</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Notas</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Observações internas"
          placeholderTextColor={colors.muted}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.disabled]}
          onPress={handleSubmit}
          disabled={submitting}
          accessibilityRole="button"
        >
          {submitting ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.submitText}>Atribuir</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl },
  topBar: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.xl },
  iconBtn: { padding: spacing.sm },
  title: { color: colors.ink, fontSize: 24, fontWeight: "800" },
  loader: { marginBottom: spacing.lg },
  label: { color: colors.text, fontSize: 13, fontWeight: "800", marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.ink,
    fontSize: 15,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    marginBottom: spacing.lg,
  },
  textArea: { minHeight: 96 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    minHeight: 38,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  chipTextActive: { color: colors.primary },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleText: { color: colors.text, fontSize: 15, fontWeight: "700" },
  submitButton: {
    minHeight: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { color: colors.surface, fontSize: 15, fontWeight: "800" },
  disabled: { opacity: 0.6 },
  errorText: { color: colors.danger, fontSize: 16, fontWeight: "700", textAlign: "center" },
});
