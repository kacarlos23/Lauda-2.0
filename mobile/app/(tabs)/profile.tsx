import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Edit3, LogOut, Settings2, Shield, User } from "lucide-react-native";
import { useAuthStore } from "../../src/store/authStore";
import { instrumentService } from "../../src/services/instrumentService";
import { memberService } from "../../src/services/memberService";
import { canManageInstrumentCatalog } from "../../src/utils/instrumentCatalog";
import { colors, radii, screen, shadow, spacing } from "../../src/theme";
import { Instrument } from "../../src/types";

function getInstrumentIds(instruments?: Instrument[]): string[] {
  return instruments?.map((item) => item.id) ?? [];
}

function getSelectedInstruments(ids: string[], availableInstruments: Instrument[], previousInstruments: Instrument[]): Instrument[] {
  return ids
    .map((id) => availableInstruments.find((instrument) => instrument.id === id) ?? previousInstruments.find((instrument) => instrument.id === id))
    .filter((instrument): instrument is Instrument => Boolean(instrument));
}

function normalizeInstrumentName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getInstrumentIcon(name: string): string {
  const normalized = normalizeInstrumentName(name);
  if (normalized.includes("bateria") || normalized.includes("percuss")) return "🥁";
  if (normalized.includes("teclado") || normalized.includes("piano")) return "🎹";
  if (normalized.includes("vocal") || normalized.includes("voz") || normalized.includes("cant")) return "🎤";
  if (normalized.includes("guitarra") || normalized.includes("violao") || normalized.includes("baixo")) return "🎸";
  if (normalized.includes("midia") || normalized.includes("som") || normalized.includes("audio")) return "🎧";
  if (normalized.includes("recepc")) return "🤝";
  return "🎵";
}

export default function ProfileScreen() {
  const { user, logout, updateCurrentUser } = useAuthStore();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const [availableInstruments, setAvailableInstruments] = useState<Instrument[]>([]);
  const [selectedInstruments, setSelectedInstruments] = useState<Instrument[]>(() => user?.instruments ?? []);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => getInstrumentIds(user?.instruments));
  const [draftInstrumentIds, setDraftInstrumentIds] = useState<string[]>(() => getInstrumentIds(user?.instruments));
  const [instrumentModalVisible, setInstrumentModalVisible] = useState(false);
  const [savingInstruments, setSavingInstruments] = useState(false);
  const [instrumentsLoading, setInstrumentsLoading] = useState(true);
  const [instrumentsError, setInstrumentsError] = useState<string | null>(null);
  const canManageInstruments = canManageInstrumentCatalog(user?.role);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const draftSet = useMemo(() => new Set(draftInstrumentIds), [draftInstrumentIds]);
  const modalMaxHeight = Math.max(360, Math.min(height - 64, 640));
  const modalListMaxHeight = Math.max(180, modalMaxHeight - 250);

  useEffect(() => {
    const instruments = user?.instruments ?? [];
    setSelectedInstruments(instruments);
    setSelectedIds(getInstrumentIds(instruments));
    setDraftInstrumentIds(getInstrumentIds(instruments));
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
      setAvailableInstruments(instruments);
      setSelectedInstruments(currentInstruments);
      setSelectedIds(currentIds);
      setDraftInstrumentIds(currentIds);
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

  const openInstrumentModal = () => {
    setDraftInstrumentIds(selectedIds);
    setInstrumentModalVisible(true);
  };

  const cancelInstrumentModal = () => {
    if (savingInstruments) return;
    setDraftInstrumentIds(selectedIds);
    setInstrumentModalVisible(false);
  };

  const toggleDraftInstrument = (instrumentId: string) => {
    setDraftInstrumentIds((current) => {
      if (current.includes(instrumentId)) {
        return current.filter((id) => id !== instrumentId);
      }
      return [...current, instrumentId];
    });
  };

  const saveInstrumentSelection = async () => {
    if (savingInstruments) return;

    const previousIds = selectedIds;
    const previousInstruments = selectedInstruments;
    const nextIds = draftInstrumentIds;
    const optimisticInstruments = getSelectedInstruments(nextIds, availableInstruments, selectedInstruments);

    setSavingInstruments(true);
    setSelectedIds(nextIds);
    setSelectedInstruments(optimisticInstruments);

    try {
      const result = await instrumentService.updateMyInstruments(nextIds);
      setSelectedIds(getInstrumentIds(result.instruments));
      setDraftInstrumentIds(getInstrumentIds(result.instruments));
      setSelectedInstruments(result.instruments);
      await updateCurrentUser({ instruments: result.instruments });
      setInstrumentModalVisible(false);
    } catch (error) {
      setSelectedIds(previousIds);
      setDraftInstrumentIds(previousIds);
      setSelectedInstruments(previousInstruments);
      showInstrumentError(error instanceof Error ? error.message : "Não foi possível atualizar instrumentos.");
    } finally {
      setSavingInstruments(false);
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
            <Text style={styles.badgeText}>{formatRole(user?.role)}</Text>
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
            <Text style={styles.rowValue}>{formatRole(user?.role)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Meus instrumentos/cargos</Text>
              <Text style={styles.instrumentHelp}>Escolha os instrumentos e cargos que aparecem no seu perfil.</Text>
            </View>
            <TouchableOpacity
              style={[styles.editInstrumentButton, (instrumentsLoading || Boolean(instrumentsError) || availableInstruments.length === 0) && styles.editInstrumentButtonDisabled]}
              onPress={openInstrumentModal}
              disabled={instrumentsLoading || Boolean(instrumentsError) || availableInstruments.length === 0}
              accessibilityRole="button"
              accessibilityLabel="Alterar instrumentos e cargos"
              testID="edit-instruments-button"
            >
              <Edit3 color={colors.primary} size={16} strokeWidth={2.5} />
              <Text style={styles.editInstrumentButtonText}>Alterar</Text>
            </TouchableOpacity>
          </View>

          {selectedInstruments.length > 0 ? (
            <View style={styles.selectedBox}>
              <Text style={styles.selectedTitle}>Selecionados</Text>
              <View style={styles.instrumentList}>
                {selectedInstruments.map((instrument) => (
                  <View
                    key={instrument.id}
                    style={[
                      styles.selectedChip,
                      {
                        backgroundColor: instrument.colorHex ?? colors.primary,
                        borderColor: instrument.colorHex ?? colors.primary,
                      },
                    ]}
                  >
                    <Text style={styles.instrumentChipTextSelected}>{getInstrumentIcon(instrument.name)} {instrument.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : !instrumentsLoading && !instrumentsError ? (
            <Text style={styles.instrumentMuted}>Nenhum instrumento/cargo selecionado.</Text>
          ) : null}

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
          ) : availableInstruments.length === 0 ? (
            <Text style={styles.instrumentMuted}>Nenhum instrumento disponível. Peça a um administrador para cadastrar instrumentos/cargos.</Text>
          ) : null}
        </View>

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

      <Modal
        animationType="fade"
        transparent
        visible={instrumentModalVisible}
        onRequestClose={cancelInstrumentModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={cancelInstrumentModal} testID="instrument-modal-backdrop" />
          <View style={[styles.instrumentModal, { maxHeight: modalMaxHeight }]} testID="instrument-selection-modal">
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Escolha seus instrumentos/cargos</Text>
            <Text style={styles.modalSubtitle}>Você pode selecionar várias opções antes de salvar.</Text>

            <ScrollView
              style={[styles.modalList, { maxHeight: modalListMaxHeight }]}
              contentContainerStyle={styles.modalListContent}
              showsVerticalScrollIndicator
            >
              {availableInstruments.map((instrument) => {
                const selected = draftSet.has(instrument.id);
                return (
                  <TouchableOpacity
                    key={instrument.id}
                    style={[
                      styles.instrumentOption,
                      selected && {
                        borderColor: instrument.colorHex ?? colors.primary,
                        backgroundColor: colors.primarySoft,
                      },
                    ]}
                    onPress={() => toggleDraftInstrument(instrument.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${selected ? "Desmarcar" : "Selecionar"} ${instrument.name}`}
                    testID={`instrument-option-${instrument.id}`}
                  >
                    <View style={[styles.instrumentIconCircle, selected && { backgroundColor: instrument.colorHex ?? colors.primary }]}> 
                      <Text style={styles.instrumentOptionIcon}>{getInstrumentIcon(instrument.name)}</Text>
                    </View>
                    <View style={styles.instrumentOptionTextBox}>
                      <Text style={styles.instrumentOptionName}>{instrument.name}</Text>
                      <Text style={styles.instrumentOptionStatus}>{selected ? "Selecionado" : "Toque para selecionar"}</Text>
                    </View>
                    <View style={[styles.checkCircle, selected && { backgroundColor: instrument.colorHex ?? colors.primary, borderColor: instrument.colorHex ?? colors.primary }]}> 
                      <Text style={styles.checkText}>{selected ? "✓" : ""}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={cancelInstrumentModal}
                disabled={savingInstruments}
                accessibilityRole="button"
                testID="cancel-instruments-selection"
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, savingInstruments && styles.saveButtonDisabled]}
                onPress={() => void saveInstrumentSelection()}
                disabled={savingInstruments}
                accessibilityRole="button"
                testID="save-instruments-selection"
              >
                {savingInstruments ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.saveButtonText}>Salvar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function formatRole(role?: string) {
  const labels: Record<string, string> = {
    GLOBAL_ADMIN: "Administrador global",
    TENANT_ADMIN: "Administrador da igreja",
    MINISTRY_LEADER: "Líder de ministério",
    MEMBER: "Membro",
  };
  return labels[role ?? ""] ?? "";
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
  instrumentHelp: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  selectedBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  selectedTitle: { color: colors.primary, fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
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
  selectedChip: {
    minHeight: 30,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  instrumentChipTextSelected: { color: colors.surface, fontSize: 13, fontWeight: "800" },
  editInstrumentButton: {
    minHeight: 38,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  editInstrumentButtonDisabled: { opacity: 0.45 },
  editInstrumentButtonText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.62)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  instrumentModal: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow,
  },
  modalHandle: {
    width: 48,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.line,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  modalTitle: { fontSize: 20, fontWeight: "900", color: colors.ink, textAlign: "center", marginBottom: spacing.xs },
  modalSubtitle: { fontSize: 13, color: colors.muted, textAlign: "center", lineHeight: 19, marginBottom: spacing.lg },
  modalList: { width: "100%" },
  modalListContent: { gap: spacing.sm, paddingBottom: spacing.sm },
  instrumentOption: {
    minHeight: 62,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  instrumentIconCircle: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  instrumentOptionIcon: { fontSize: 22 },
  instrumentOptionTextBox: { flex: 1 },
  instrumentOptionName: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  instrumentOptionStatus: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 2 },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  checkText: { color: colors.surface, fontSize: 15, fontWeight: "900" },
  modalActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  modalButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.line },
  cancelButtonText: { color: colors.text, fontSize: 14, fontWeight: "900" },
  saveButton: { backgroundColor: colors.primary },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { color: colors.surface, fontSize: 14, fontWeight: "900" },
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