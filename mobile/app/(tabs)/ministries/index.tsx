import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { BottomSheet } from "../../../src/components/BottomSheet";
import { useAuthStore } from "../../../src/store/authStore";
import { useMinistryStore } from "../../../src/store/ministryStore";
import { buttonShadow, colors, radii, screen, shadow, spacing } from "../../../src/theme";

export default function MinistriesScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    ministries,
    loading,
    error,
    fetchMinistries,
    refreshing,
    setRefreshing,
    createMinistry,
    clearError,
  } = useMinistryStore();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.role === "TENANT_ADMIN" || user?.role === "GLOBAL_ADMIN";

  useFocusEffect(
    useCallback(() => {
      void fetchMinistries();
    }, [fetchMinistries])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMinistries();
    setRefreshing(false);
  }, [fetchMinistries, setRefreshing]);

  const openCreate = () => {
    clearError();
    setFormError(null);
    setName("");
    setDescription("");
    setShowCreate(true);
  };

  const closeCreate = () => {
    if (submitting) return;
    setShowCreate(false);
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (trimmedName.length < 2) {
      setFormError("Informe um nome com ao menos 2 caracteres.");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    await createMinistry({
      name: trimmedName,
      description: trimmedDescription || undefined,
    });
    setSubmitting(false);

    if (!useMinistryStore.getState().error) {
      setShowCreate(false);
      setName("");
      setDescription("");
    }
  };

  if (loading && ministries.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <FlatList
        data={ministries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Ministérios</Text>
            <Text style={styles.subtitle}>{ministries.length} grupo(s) ativo(s)</Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Nenhum ministério cadastrado</Text>
            <Text style={styles.emptyText}>
              {isAdmin
                ? "Crie o primeiro ministério para organizar equipes e escalas."
                : "Você ainda não está vinculado a nenhum ministério."}
            </Text>
            {isAdmin ? (
              <TouchableOpacity style={styles.emptyButton} onPress={openCreate} accessibilityRole="button">
                <Text style={styles.emptyButtonText}>Criar ministério</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.75}
            onPress={() => router.push(`/ministries/${item.id}` as never)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{item._count?.members ?? 0}</Text>
              </View>
            </View>
            {item.description ? (
              <Text style={styles.cardDesc} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
            <Text style={styles.cardMeta}>membro(s) vinculados</Text>
          </TouchableOpacity>
        )}
      />

      {isAdmin ? (
        <TouchableOpacity style={styles.fab} activeOpacity={0.8} onPress={openCreate} accessibilityRole="button">
          <Plus color={colors.surface} size={24} />
        </TouchableOpacity>
      ) : null}

      <BottomSheet
        isOpen={showCreate}
        onClose={closeCreate}
        onBack={closeCreate}
        title="Novo ministério"
        footer={
          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={closeCreate} disabled={submitting}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, submitting && styles.buttonDisabled]}
              onPress={handleCreate}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.saveButtonText}>Criar</Text>}
            </TouchableOpacity>
          </View>
        }
      >
        <View style={styles.form}>
          {formError || error ? <Text style={styles.formError}>{formError ?? error}</Text> : null}
          <Text style={styles.label}>Nome *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Louvor"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={(value) => {
              setName(value);
              setFormError(null);
            }}
            autoFocus
          />
          <Text style={styles.label}>Descrição</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Descreva o objetivo deste ministério"
            placeholderTextColor={colors.muted}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    width: "100%",
    maxWidth: screen.listMaxWidth,
    alignSelf: "center",
    padding: spacing.xl,
    paddingBottom: 120,
  },
  header: { marginBottom: spacing.lg },
  title: { fontSize: 30, fontWeight: "900", color: colors.ink, marginBottom: spacing.xs },
  subtitle: { fontSize: 15, color: colors.muted, fontWeight: "700" },
  errorText: { color: colors.danger, fontSize: 14, marginTop: spacing.sm },
  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
  },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: "800", marginBottom: spacing.sm },
  emptyText: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  emptyButton: {
    alignSelf: "flex-start",
    marginTop: spacing.lg,
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    ...buttonShadow,
  },
  emptyButtonText: { color: colors.surface, fontSize: 14, fontWeight: "800" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: { flex: 1, fontSize: 18, fontWeight: "800", color: colors.ink },
  countBadge: {
    minWidth: 34,
    height: 34,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  countText: { color: colors.primaryDark, fontSize: 14, fontWeight: "800" },
  cardDesc: { fontSize: 15, color: colors.text, lineHeight: 22, marginBottom: spacing.md },
  cardMeta: { fontSize: 12, color: colors.primary, fontWeight: "800", textTransform: "uppercase" },
  fab: {
    position: "absolute",
    bottom: spacing.xxl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    ...shadow,
    ...buttonShadow,
  },
  form: { padding: spacing.xl },
  formError: {
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
  label: { color: colors.text, fontSize: 13, fontWeight: "800", marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.ink,
    fontSize: 15,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    marginBottom: spacing.lg,
  },
  textArea: { minHeight: 104 },
  sheetActions: {
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "flex-end",
  },
  cancelButton: {
    minHeight: 44,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  cancelButtonText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  saveButton: {
    minHeight: 44,
    minWidth: 96,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  saveButtonText: { color: colors.surface, fontSize: 14, fontWeight: "800" },
  buttonDisabled: { opacity: 0.6 },
});
