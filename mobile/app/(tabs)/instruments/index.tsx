import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { Edit3, Plus, Save, Trash2, X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../../src/store/authStore";
import { useInstrumentStore } from "../../../src/store/instrumentStore";
import {
  canManageInstrumentCatalog,
  buildDeleteInstrumentConfirmation,
  instrumentColorPattern,
  normalizeColorHex,
  normalizeInstrumentName,
  validateInstrumentForm,
} from "../../../src/utils/instrumentCatalog";
import { Instrument } from "../../../src/types";
import { colors, radii, screen, shadow, spacing } from "../../../src/theme";
import { AppBackButton } from "../../../src/components/AppBackButton";
import { safeReturnTo } from "../../../src/utils/navigation";

const emptyForm = { name: "", colorHex: "" };

export default function InstrumentCatalogScreen() {
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = safeReturnTo(params.returnTo, ["/profile", "/church"], "/profile");
  const { user } = useAuthStore();
  const {
    instruments,
    loading,
    saving,
    deletingId,
    error,
    clearError,
    createInstrument,
    deleteInstrument,
    loadInstruments,
    updateInstrument,
  } = useInstrumentStore();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (canManageInstrumentCatalog(user?.role)) {
      void loadInstruments();
    }
  }, [loadInstruments, user?.role]);

  if (!canManageInstrumentCatalog(user?.role)) {
    return <Redirect href="/(tabs)/profile" />;
  }

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormError(null);
  };

  const showStoreError = () => {
    const message = useInstrumentStore.getState().error;
    if (message) {
      Alert.alert("Erro", message);
      return true;
    }

    return false;
  };

  const handleSubmit = async () => {
    const validation = validateInstrumentForm(form);
    if (validation) {
      setFormError(validation);
      return;
    }

    setFormError(null);
    const payload = {
      name: normalizeInstrumentName(form.name),
      colorHex: normalizeColorHex(form.colorHex),
    };

    if (editingId) {
      await updateInstrument(editingId, payload);
    } else {
      await createInstrument(payload);
    }

    if (!showStoreError()) {
      resetForm();
    }
  };

  const handleEdit = (instrument: Instrument) => {
    clearError();
    setForm({
      name: instrument.name,
      colorHex: instrument.colorHex ?? "",
    });
    setEditingId(instrument.id);
    setFormError(null);
  };

  const handleDelete = (instrument: Instrument) => {
    const confirmation = buildDeleteInstrumentConfirmation(async () => {
      await deleteInstrument(instrument.id);
      showStoreError();
      if (editingId === instrument.id) {
        resetForm();
      }
    });

    Alert.alert(confirmation.title, confirmation.message, confirmation.buttons);
  };

  const retryLoad = () => {
    clearError();
    void loadInstruments();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.backRow}><AppBackButton href={returnTo} /></View>
        <View style={styles.header}>
          <Text style={styles.title}>Instrumentos/Cargos</Text>
          <Text style={styles.subtitle}>Gerencie o catálogo usado nos perfis e na lista de membros.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{editingId ? "Editar instrumento/cargo" : "Novo instrumento/cargo"}</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(name) => setForm((current) => ({ ...current, name }))}
            placeholder="Nome"
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
            testID="instrument-name-input"
          />
          <View style={styles.colorRow}>
            <TextInput
              style={[styles.input, styles.colorInput]}
              value={form.colorHex}
              onChangeText={(colorHex) => setForm((current) => ({ ...current, colorHex }))}
              placeholder="#RRGGBB opcional"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              testID="instrument-color-input"
            />
            <View
              style={[
                styles.colorPreview,
                {
                  backgroundColor:
                    form.colorHex && instrumentColorPattern.test(form.colorHex)
                      ? normalizeColorHex(form.colorHex) ?? colors.surfaceMuted
                      : colors.surfaceMuted,
                },
              ]}
            />
          </View>
          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
          <View style={styles.formActions}>
            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.disabledButton]}
              onPress={() => void handleSubmit()}
              disabled={saving}
              accessibilityRole="button"
              testID="instrument-save-button"
            >
              {saving ? (
                <ActivityIndicator color={colors.surface} />
              ) : editingId ? (
                <Save color={colors.surface} size={17} />
              ) : (
                <Plus color={colors.surface} size={17} />
              )}
              <Text style={styles.primaryButtonText}>{editingId ? "Salvar" : "Criar"}</Text>
            </TouchableOpacity>
            {editingId ? (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={resetForm}
                accessibilityRole="button"
                testID="instrument-cancel-edit-button"
              >
                <X color={colors.primary} size={17} />
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Catálogo</Text>
            {loading ? <ActivityIndicator color={colors.primary} /> : null}
          </View>
          {error && !loading ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.secondaryButton} onPress={retryLoad} accessibilityRole="button">
                <Text style={styles.secondaryButtonText}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!loading && instruments.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum instrumento cadastrado.</Text>
          ) : (
            <View style={styles.instrumentList}>
              {instruments.map((instrument) => {
                const isDeleting = deletingId === instrument.id;
                return (
                  <View key={instrument.id} style={styles.instrumentRow}>
                    <View
                      style={[
                        styles.instrumentColor,
                        { backgroundColor: instrument.colorHex ?? colors.primarySoft },
                      ]}
                    />
                    <View style={styles.instrumentInfo}>
                      <Text style={styles.instrumentName}>{instrument.name}</Text>
                      <Text style={styles.instrumentColorText}>{instrument.colorHex ?? "Sem cor definida"}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => handleEdit(instrument)}
                      disabled={isDeleting}
                      accessibilityRole="button"
                      accessibilityLabel={`Editar ${instrument.name}`}
                      testID={`instrument-edit-${instrument.id}`}
                    >
                      <Edit3 color={colors.primary} size={18} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.iconButton, styles.dangerButton]}
                      onPress={() => handleDelete(instrument)}
                      disabled={isDeleting}
                      accessibilityRole="button"
                      accessibilityLabel={`Excluir ${instrument.name}`}
                      testID={`instrument-delete-${instrument.id}`}
                    >
                      {isDeleting ? <ActivityIndicator color={colors.danger} /> : <Trash2 color={colors.danger} size={18} />}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    width: "100%",
    maxWidth: screen.maxWidth,
    alignSelf: "center",
    padding: spacing.xl,
    paddingBottom: 120,
  },
  header: { marginBottom: spacing.lg },
  backRow: { marginBottom: spacing.lg },
  title: { color: colors.ink, fontSize: 28, fontWeight: "800", marginBottom: spacing.xs },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    ...shadow,
  },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "800", marginBottom: spacing.md },
  input: {
    minHeight: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceMuted,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "600",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  colorRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  colorInput: { flex: 1 },
  colorPreview: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.md,
  },
  formActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  primaryButton: {
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  primaryButtonText: { color: colors.surface, fontSize: 14, fontWeight: "800" },
  secondaryButton: {
    minHeight: 40,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  secondaryButtonText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  disabledButton: { opacity: 0.72 },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  errorBox: { gap: spacing.sm, marginBottom: spacing.md, alignItems: "flex-start" },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: "700", marginBottom: spacing.sm },
  emptyText: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  instrumentList: { gap: spacing.sm },
  instrumentRow: {
    minHeight: 66,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  instrumentColor: {
    width: 28,
    height: 28,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  instrumentInfo: { flex: 1 },
  instrumentName: { color: colors.ink, fontSize: 15, fontWeight: "800", marginBottom: spacing.xs },
  instrumentColorText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  dangerButton: { backgroundColor: "#F7E1E1" },
});
