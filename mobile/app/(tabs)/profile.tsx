import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, Globe2, LogOut, Plus, Settings2, Shield, User, X } from "lucide-react-native";
import { useAuthStore } from "../../src/store/authStore";
import { instrumentService } from "../../src/services/instrumentService";
import { memberService } from "../../src/services/memberService";
import {
  canManageInstrumentCatalog,
  normalizeColorHex,
  normalizeInstrumentName,
  validateInstrumentForm,
} from "../../src/utils/instrumentCatalog";
import { formatRoleLabel, isGlobalAdmin } from "../../src/utils/permissions";
import { colors, radii, screen, shadow, spacing } from "../../src/theme";
import { Instrument } from "../../src/types";

const emptyInstrumentForm = { name: "", colorHex: "" };

function getInstrumentIds(instruments?: Instrument[]): string[] {
  return instruments?.map((item) => item.id) ?? [];
}

function sortInstruments(instruments: Instrument[]): Instrument[] {
  return [...instruments].sort((first, second) =>
    first.name.localeCompare(second.name, "pt-BR", { sensitivity: "base" })
  );
}

function readableTextColor(backgroundColor?: string | null): string {
  if (!backgroundColor || !/^#[0-9A-Fa-f]{6}$/.test(backgroundColor)) return colors.primaryDark;

  const red = parseInt(backgroundColor.slice(1, 3), 16);
  const green = parseInt(backgroundColor.slice(3, 5), 16);
  const blue = parseInt(backgroundColor.slice(5, 7), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? colors.ink : colors.surface;
}

export default function ProfileScreen() {
  const { user, logout, updateCurrentUser } = useAuthStore();
  const router = useRouter();
  const [availableInstruments, setAvailableInstruments] = useState<Instrument[]>([]);
  const [selectedInstruments, setSelectedInstruments] = useState<Instrument[]>(() => user?.instruments ?? []);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => getInstrumentIds(user?.instruments));
  const [instrumentsLoading, setInstrumentsLoading] = useState(true);
  const [instrumentsError, setInstrumentsError] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [instrumentForm, setInstrumentForm] = useState(emptyInstrumentForm);
  const [instrumentFormError, setInstrumentFormError] = useState<string | null>(null);
  const [creatingInstrument, setCreatingInstrument] = useState(false);
  const canManageInstruments = canManageInstrumentCatalog(user?.role);
  const hasGlobalAccess = isGlobalAdmin(user);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  useEffect(() => {
    const instruments = user?.instruments ?? [];
    setSelectedInstruments(instruments);
    setSelectedIds(getInstrumentIds(instruments));
  }, [user?.id, user?.instruments]);

  const loadInstruments = async () => {
    try {
      setInstrumentsError(null);
      setInstrumentsLoading(true);
      const [instruments, currentMember] = await Promise.all([
        instrumentService.getInstruments(),
        memberService.getCurrentMember(),
      ]);
      const currentInstruments = currentMember.instruments ?? [];
      const currentIds = getInstrumentIds(currentInstruments);
      setAvailableInstruments(sortInstruments(instruments));
      setSelectedInstruments(currentInstruments);
      setSelectedIds(currentIds);
      await updateCurrentUser({
        id: currentMember.id,
        name: currentMember.name,
        email: currentMember.email,
        role: currentMember.role,
        tenantId: currentMember.tenantId,
        instruments: currentInstruments,
      });
    } catch (error) {
      setInstrumentsError(error instanceof Error ? error.message : "Não foi possível carregar instrumentos.");
    } finally {
      setInstrumentsLoading(false);
    }
  };

  useEffect(() => {
    void loadInstruments();
  }, []);

  const performLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  const handleLogout = () => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Deseja encerrar sua sessão?");
      if (confirmed) {
        void performLogout();
      }
      return;
    }
    Alert.alert("Sair", "Deseja encerrar sua sessão?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: () => void performLogout(),
      },
    ]);
  };

  const showInstrumentError = (message: string) => {
    Alert.alert("Erro", message);
  };

  const handleToggleInstrument = async (instrumentId: string) => {

    const previousIds = selectedIds;
    const previousInstruments = selectedInstruments;
    const nextIds = selectedSet.has(instrumentId)
      ? selectedIds.filter((id) => id !== instrumentId)
      : [...selectedIds, instrumentId];
    const optimisticInstruments = nextIds
      .map((id) => availableInstruments.find((instrument) => instrument.id === id) ?? selectedInstruments.find((instrument) => instrument.id === id))
      .filter((instrument): instrument is Instrument => Boolean(instrument));

    setSelectedIds(nextIds);
    setSelectedInstruments(optimisticInstruments);

    try {
      const result = await instrumentService.updateMyInstruments(nextIds);
      setSelectedIds(getInstrumentIds(result.instruments));
      setSelectedInstruments(result.instruments);
      await updateCurrentUser({ instruments: result.instruments });
    } catch (error) {
      setSelectedIds(previousIds);
      setSelectedInstruments(previousInstruments);
      showInstrumentError(error instanceof Error ? error.message : "Não foi possível atualizar instrumentos.");
    }
  };

  const resetInstrumentForm = () => {
    setInstrumentForm(emptyInstrumentForm);
    setInstrumentFormError(null);
  };

  const handleCreateInstrument = async () => {
    const validation = validateInstrumentForm(instrumentForm);
    if (validation) {
      setInstrumentFormError(validation);
      return;
    }

    setCreatingInstrument(true);
    setInstrumentFormError(null);

    try {
      const created = await instrumentService.createInstrument({
        name: normalizeInstrumentName(instrumentForm.name),
        colorHex: normalizeColorHex(instrumentForm.colorHex),
      });
      const nextIds = Array.from(new Set([...selectedIds, created.id]));
      const result = await instrumentService.updateMyInstruments(nextIds);

      setAvailableInstruments((current) => sortInstruments([...current.filter((item) => item.id !== created.id), created]));
      setSelectedIds(getInstrumentIds(result.instruments));
      setSelectedInstruments(result.instruments);
      await updateCurrentUser({ instruments: result.instruments });
      resetInstrumentForm();
    } catch (error) {
      setInstrumentFormError(error instanceof Error ? error.message : "Não foi possível criar o instrumento.");
    } finally {
      setCreatingInstrument(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <User color={colors.surface} size={38} strokeWidth={2.4} />
          </View>

          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.badge}>
            <Shield color={colors.primaryDark} size={14} strokeWidth={2.4} />
            <Text style={styles.badgeText}>{formatRoleLabel(user?.role)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conta</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Nome</Text>
            <Text style={styles.rowValue}>{user?.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>E-mail</Text>
            <Text style={styles.rowValue}>{user?.email}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Permissão</Text>
            <Text style={styles.rowValue}>{formatRoleLabel(user?.role)}</Text>
          </View>
        </View>

        {hasGlobalAccess ? (
          <View style={styles.globalAccessCard}>
            <View style={styles.globalAccessHeader}>
              <View style={styles.globalAccessIcon}>
                <Globe2 color={colors.primary} size={22} strokeWidth={2.5} />
              </View>
              <View style={styles.globalAccessTextBox}>
                <Text style={styles.globalAccessTitle}>Acesso global</Text>
                <Text style={styles.globalAccessText}>
                  Você pode visualizar e administrar todas as igrejas cadastradas no sistema.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.globalAccessButton}
              onPress={() => router.push("/global-admin" as never)}
              accessibilityRole="button"
              testID="open-global-admin-button"
            >
              <Text style={styles.globalAccessButtonText}>Abrir Painel Global</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Meus instrumentos/cargos</Text>
            {!instrumentsLoading && !instrumentsError ? (
              <TouchableOpacity
                style={styles.editInstrumentsButton}
                onPress={() => setPickerVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Selecionar instrumentos e cargos"
                testID="open-instrument-picker"
              >
                <Text style={styles.editInstrumentsButtonText}>
                  {selectedInstruments.length > 0 ? "Editar" : "Selecionar"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {instrumentsLoading ? (
            <View style={styles.instrumentLoading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.instrumentMuted}>Carregando instrumentos...</Text>
            </View>
          ) : instrumentsError ? (
            <View style={styles.instrumentLoading}>
              <Text style={styles.errorText}>{instrumentsError}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadInstruments} accessibilityRole="button">
                <Text style={styles.retryButtonText}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          ) : selectedInstruments.length === 0 ? (
            <Text style={styles.instrumentMuted}>Nenhum instrumento selecionado</Text>
          ) : (
            <View style={styles.instrumentList}>
              {selectedInstruments.map((instrument) => (
                <View
                  key={instrument.id}
                  style={[
                    styles.instrumentChip,
                    {
                      backgroundColor: instrument.colorHex ?? colors.primarySoft,
                      borderColor: instrument.colorHex ?? colors.line,
                    },
                  ]}
                >
                  <Text style={[styles.instrumentChipText, { color: readableTextColor(instrument.colorHex) }]}>
                    {instrument.name}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <Modal
          visible={pickerVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setPickerVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleGroup}>
                  <Text style={styles.modalTitle}>Selecionar instrumentos/cargos</Text>
                  <Text style={styles.modalSubtitle}>Toque nas opções para atualizar o seu perfil.</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setPickerVisible(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Fechar seleção de instrumentos"
                >
                  <X color={colors.primary} size={20} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              {canManageInstruments ? (
                <View style={styles.createInstrumentBox}>
                  <Text style={styles.createInstrumentTitle}>Novo instrumento/cargo</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={instrumentForm.name}
                    onChangeText={(name) => {
                      setInstrumentForm((current) => ({ ...current, name }));
                      setInstrumentFormError(null);
                    }}
                    placeholder="Nome"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="words"
                    testID="profile-instrument-name-input"
                  />
                  <TextInput
                    style={styles.modalInput}
                    value={instrumentForm.colorHex}
                    onChangeText={(colorHex) => {
                      setInstrumentForm((current) => ({ ...current, colorHex }));
                      setInstrumentFormError(null);
                    }}
                    placeholder="#RRGGBB opcional"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="characters"
                    testID="profile-instrument-color-input"
                  />
                  {instrumentFormError ? <Text style={styles.errorText}>{instrumentFormError}</Text> : null}
                  <TouchableOpacity
                    style={[styles.createInstrumentButton, creatingInstrument && styles.buttonDisabled]}
                    onPress={() => void handleCreateInstrument()}
                    disabled={creatingInstrument}
                    accessibilityRole="button"
                    testID="profile-instrument-create-button"
                  >
                    {creatingInstrument ? (
                      <ActivityIndicator color={colors.surface} />
                    ) : (
                      <Plus color={colors.surface} size={17} strokeWidth={2.4} />
                    )}
                    <Text style={styles.createInstrumentButtonText}>Criar e selecionar</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
                {availableInstruments.length === 0 ? (
                  <Text style={styles.instrumentMuted}>Nenhum instrumento disponível</Text>
                ) : (
                  availableInstruments.map((instrument) => {
                    const selected = selectedSet.has(instrument.id);
                    return (
                      <TouchableOpacity
                        key={instrument.id}
                        style={[styles.modalInstrumentRow, selected && styles.modalInstrumentRowSelected]}
                        onPress={() => void handleToggleInstrument(instrument.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`${selected ? "Remover" : "Adicionar"} ${instrument.name}`}
                        testID={`instrument-toggle-${instrument.id}`}
                      >
                        <View
                          style={[
                            styles.modalInstrumentColor,
                            { backgroundColor: instrument.colorHex ?? colors.primarySoft },
                          ]}
                        />
                        <Text style={styles.modalInstrumentName}>{instrument.name}</Text>
                        {selected ? <Check color={colors.primary} size={20} strokeWidth={2.8} /> : null}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {canManageInstruments ? (
          <TouchableOpacity
            style={styles.adminButton}
            onPress={() => router.push("/instruments" as never)}
            accessibilityRole="button"
            accessibilityLabel="Gerenciar instrumentos e cargos"
            testID="manage-instruments-button"
          >
            <Settings2 color={colors.primary} size={18} strokeWidth={2.5} />
            <Text style={styles.adminButtonText}>Gerenciar instrumentos/cargos</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} testID="logout-submit">
          <LogOut color={colors.surface} size={18} strokeWidth={2.6} />
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
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
    paddingBottom: spacing.xxl,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    alignItems: "center",
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.lg,
    ...shadow,
  },
  avatarCircle: {
    width: 92,
    height: 92,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  name: { fontSize: 24, fontWeight: "800", color: colors.ink, marginBottom: spacing.xs, textAlign: "center" },
  email: { fontSize: 14, color: colors.muted, marginBottom: spacing.lg, textAlign: "center" },
  badge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  badgeText: { color: colors.primaryDark, fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeaderText: { flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.ink, marginBottom: spacing.md },
  row: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  rowLabel: { fontSize: 12, fontWeight: "800", color: colors.primary, textTransform: "uppercase", marginBottom: spacing.xs },
  rowValue: { fontSize: 15, color: colors.text, fontWeight: "600" },
  globalAccessCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.lg,
    ...shadow,
  },
  globalAccessHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  globalAccessIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  globalAccessTextBox: { flex: 1 },
  globalAccessTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", marginBottom: spacing.xs },
  globalAccessText: { color: colors.text, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  globalAccessButton: {
    minHeight: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  globalAccessButtonText: { color: colors.surface, fontSize: 14, fontWeight: "900" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  editInstrumentsButton: {
    minHeight: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  editInstrumentsButtonText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  instrumentLoading: {
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  instrumentMuted: { color: colors.muted, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  errorText: { color: colors.danger, fontSize: 14, fontWeight: "700" },
  retryButton: {
    minHeight: 38,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  retryButtonText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  instrumentList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  instrumentChip: {
    minHeight: 30,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  instrumentChipText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  instrumentChipTextSelected: { color: colors.surface, fontSize: 13, fontWeight: "800" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(23, 33, 26, 0.42)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: screen.maxWidth,
    maxHeight: "88%",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    ...shadow,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  modalTitleGroup: { flex: 1 },
  modalTitle: { color: colors.ink, fontSize: 18, fontWeight: "800", marginBottom: spacing.xs },
  modalSubtitle: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  createInstrumentBox: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  createInstrumentTitle: { color: colors.ink, fontSize: 14, fontWeight: "800", marginBottom: spacing.md },
  modalInput: {
    minHeight: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  createInstrumentButton: {
    minHeight: 42,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  createInstrumentButtonText: { color: colors.surface, fontSize: 14, fontWeight: "800" },
  buttonDisabled: { opacity: 0.7 },
  modalList: { flexGrow: 0 },
  modalListContent: { gap: spacing.sm },
  modalInstrumentRow: {
    minHeight: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  modalInstrumentRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  modalInstrumentColor: {
    width: 24,
    height: 24,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  modalInstrumentName: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: "800" },
  adminButton: {
    width: "100%",
    minHeight: 46,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  adminButtonText: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  logoutBtn: {
    width: "100%",
    backgroundColor: colors.danger,
    borderRadius: radii.sm,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  logoutText: { color: colors.surface, fontSize: 16, fontWeight: "800" },
});
