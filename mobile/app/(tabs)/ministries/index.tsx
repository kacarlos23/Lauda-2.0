import React, { useCallback, useState } from "react";
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
import { useFocusEffect, useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { BottomSheet } from "../../../src/components/BottomSheet";
import { AppInput, Button, EmptyState, ErrorBanner, FilterButton, FilterPanel, LoadingState, RichCommentEditor, Screen, SectionHeader } from "../../../src/components/ui";
import { useAuthStore } from "../../../src/store/authStore";
import { useMinistryStore } from "../../../src/store/ministryStore";
import { colors, radii, screen, spacing, typography } from "../../../src/theme";
import { emptyMinistryFilters, filterMinistries, hasActiveFilters, MinistryListFilters } from "../../../src/utils/listFilters";
import { can } from "../../../src/utils/permissions";

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
  const [comments, setComments] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [filters, setFilters] = useState<MinistryListFilters>(emptyMinistryFilters);
  const [draftFilters, setDraftFilters] = useState<MinistryListFilters>(emptyMinistryFilters);
  const [showFilters, setShowFilters] = useState(false);

  const canCreateMinistry = can(user, "ministry:create");
  const activeFilters = hasActiveFilters(filters);
  const canApplyFilters = hasActiveFilters(draftFilters);
  const filteredMinistries = filterMinistries(ministries, filters);

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


  const openFilters = () => {
    setDraftFilters(filters);
    setShowFilters(true);
  };

  const clearFilters = () => {
    setFilters(emptyMinistryFilters);
    setDraftFilters(emptyMinistryFilters);
    setShowFilters(false);
  };

  const applyFilters = () => {
    if (!hasActiveFilters(draftFilters)) return;
    setFilters(draftFilters);
    setShowFilters(false);
  };
  const openCreate = () => {
    clearError();
    setFormError(null);
    setName("");
    setDescription("");
    setComments("");
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
      comments: comments || null,
    });
    setSubmitting(false);

    if (!useMinistryStore.getState().error) {
      setShowCreate(false);
      setName("");
      setDescription("");
      setComments("");
    }
  };

  if (loading && ministries.length === 0) {
    return <LoadingState message="Carregando ministérios..." />;
  }

  return (
    <Screen padded={false}>
      <FilterPanel
        visible={showFilters}
        title="Filtrar ministérios"
        canApply={canApplyFilters}
        onApply={applyFilters}
        onClose={() => setShowFilters(false)}
        onClear={activeFilters || canApplyFilters ? clearFilters : undefined}
      >
        <AppInput
          label="Palavra-chave geral"
          value={draftFilters.query ?? ""}
          onChangeText={(query) => setDraftFilters((current) => ({ ...current, query }))}
          placeholder="Nome ou descrição"
          accessibilityLabel="Buscar ministérios"
        />
      </FilterPanel>
      <FlatList
        data={filteredMinistries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <SectionHeader
              title="Ministérios"
              subtitle={activeFilters ? `${filteredMinistries.length} de ${ministries.length} ministério(s)` : `${ministries.length} ministério(s) ativo(s)`}
              action={(
                <View style={styles.headerActions}>
                  <FilterButton active={activeFilters} onPress={openFilters} accessibilityLabel="Abrir filtros de ministérios" />
                  {canCreateMinistry ? (
                    <Button
                      title="Novo ministério"
                      icon={<Plus color={colors.inverse} size={18} strokeWidth={2.2} />}
                      onPress={openCreate}
                      accessibilityLabel="Criar ministério"
                    />
                  ) : null}
                </View>
              )}
              style={styles.sectionHeader}
            />
            {activeFilters ? <Button title="Limpar filtros" variant="ghost" size="sm" style={styles.clearFiltersButton} onPress={clearFilters} accessibilityLabel="Limpar filtros de ministérios" /> : null}
            <ErrorBanner
              message={error}
              style={styles.errorText}
              action={error ? (
                <Button
                  title="Tentar novamente"
                  variant="secondary"
                  size="sm"
                  style={styles.retryButton}
                  onPress={() => void handleRefresh()}
                  accessibilityLabel="Tentar carregar ministérios novamente"
                />
              ) : null}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={activeFilters ? "Nenhum ministério encontrado" : "Nenhum ministério cadastrado"}
            description={
              activeFilters
                ? "Ajuste ou limpe os filtros para ver outros ministérios."
                : canCreateMinistry
                  ? "Crie o primeiro ministério para organizar equipes e escalas."
                  : "Você ainda não está vinculado a nenhum ministério."
            }
            action={activeFilters ? (
              <Button title="Limpar filtros" variant="secondary" onPress={clearFilters} accessibilityLabel="Limpar filtros de ministérios" />
            ) : canCreateMinistry ? (
              <Button
                title="Criar ministério"
                size="lg"
                style={styles.emptyButton}
                onPress={openCreate}
                accessibilityLabel="Criar ministério"
              />
            ) : null}
          />
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
          <ErrorBanner message={formError ?? error} style={styles.formError} />
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
          <RichCommentEditor value={comments} onChange={setComments} label="Comentários" placeholder="Orientações e observações sobre o ministério..." testID="ministry-comments-input" />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    width: "100%",
    maxWidth: screen.listMaxWidth,
    alignSelf: "center",
    padding: spacing.xl,
    paddingBottom: screen.contentBottomPadding,
  },
  header: { marginBottom: spacing.lg },
  sectionHeader: { marginBottom: 0 },
  headerActions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm },
  clearFiltersButton: { alignSelf: "flex-start" },
  errorText: { marginTop: spacing.sm },
  retryButton: { alignSelf: "flex-start", marginTop: spacing.sm },
  emptyButton: {
    alignSelf: "flex-start",
    marginTop: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 0,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    marginBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: { ...typography.sectionTitle, flex: 1, color: colors.ink },
  countBadge: {
    minWidth: 34,
    height: 34,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  countText: { ...typography.label, color: colors.primaryDark },
  cardDesc: { ...typography.body, color: colors.text, marginBottom: spacing.md },
  cardMeta: { ...typography.badge, color: colors.primary, textTransform: "uppercase" },
  form: { padding: spacing.xl },
  formError: {
    marginBottom: spacing.lg,
  },
  label: { ...typography.label, color: colors.text, marginBottom: spacing.sm },
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
  cancelButtonText: { ...typography.button, color: colors.text },
  saveButton: {
    minHeight: 44,
    minWidth: 96,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  saveButtonText: { ...typography.button, color: colors.surface },
  buttonDisabled: { opacity: 0.6 },
});
