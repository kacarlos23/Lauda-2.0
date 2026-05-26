import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogOut, Settings2, Shield, User } from "lucide-react-native";
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

export default function ProfileScreen() {
  const { user, logout, updateCurrentUser } = useAuthStore();
  const router = useRouter();
  const [availableInstruments, setAvailableInstruments] = useState<Instrument[]>([]);
  const [selectedInstruments, setSelectedInstruments] = useState<Instrument[]>(() => user?.instruments ?? []);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => getInstrumentIds(user?.instruments));
  const [pendingInstrumentIds, setPendingInstrumentIds] = useState<string[]>([]);
  const [instrumentsLoading, setInstrumentsLoading] = useState(true);
  const [instrumentsError, setInstrumentsError] = useState<string | null>(null);
  const canManageInstruments = canManageInstrumentCatalog(user?.role);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const pendingSet = useMemo(() => new Set(pendingInstrumentIds), [pendingInstrumentIds]);

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
      setAvailableInstruments(instruments);
      setSelectedInstruments(currentInstruments);
      setSelectedIds(getInstrumentIds(currentInstruments));
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
    if (pendingSet.has(instrumentId)) return;

    const previousIds = selectedIds;
    const previousInstruments = selectedInstruments;
    const nextIds = selectedSet.has(instrumentId)
      ? selectedIds.filter((id) => id !== instrumentId)
      : [...selectedIds, instrumentId];
    const optimisticInstruments = getSelectedInstruments(nextIds, availableInstruments, selectedInstruments);

    setPendingInstrumentIds((current) => [...current, instrumentId]);
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
    } finally {
      setPendingInstrumentIds((current) => current.filter((id) => id !== instrumentId));
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
          <Text style={styles.sectionTitle}>Meus instrumentos/cargos</Text>
          <Text style={styles.instrumentHelp}>
            Toque em um instrumento para adicionar ou remover do seu perfil. A alteração é salva automaticamente.
          </Text>

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
                    <Text style={styles.instrumentChipTextSelected}>{instrument.name}</Text>
                  </View>
                ))}
              </View>
            </View>
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
          ) : (
            <View style={styles.instrumentList}>
              {availableInstruments.map((instrument) => {
                const selected = selectedSet.has(instrument.id);
                const pending = pendingSet.has(instrument.id);
                return (
                  <TouchableOpacity
                    key={instrument.id}
                    style={[
                      styles.instrumentChip,
                      selected && {
                        backgroundColor: instrument.colorHex ?? colors.primary,
                        borderColor: instrument.colorHex ?? colors.primary,
                      },
                      pending && styles.instrumentChipPending,
                    ]}
                    onPress={() => void handleToggleInstrument(instrument.id)}
                    disabled={pending}
                    accessibilityRole="button"
                    accessibilityLabel={`${selected ? "Remover" : "Adicionar"} ${instrument.name}`}
                    testID={`instrument-toggle-${instrument.id}`}
                  >
                    <Text style={[styles.instrumentChipText, selected && styles.instrumentChipTextSelected]}>
                      {pending ? "Salvando..." : instrument.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
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
  sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.ink, marginBottom: spacing.md },
  row: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  rowLabel: { fontSize: 12, fontWeight: "800", color: colors.primary, textTransform: "uppercase", marginBottom: spacing.xs },
  rowValue: { fontSize: 15, color: colors.text, fontWeight: "600" },
  instrumentHelp: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
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
  instrumentChip: {
    minHeight: 38,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedChip: {
    minHeight: 30,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  instrumentChipPending: {
    opacity: 0.7,
  },
  instrumentChipText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  instrumentChipTextSelected: { color: colors.surface, fontSize: 13, fontWeight: "800" },
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