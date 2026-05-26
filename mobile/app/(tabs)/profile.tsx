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

export default function ProfileScreen() {
  const { user, logout, updateCurrentUser } = useAuthStore();
  const router = useRouter();
  const [availableInstruments, setAvailableInstruments] = useState<Instrument[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => user?.instruments?.map((item) => item.id) ?? []);
  const [instrumentsLoading, setInstrumentsLoading] = useState(true);
  const [instrumentsError, setInstrumentsError] = useState<string | null>(null);
  const canManageInstruments = canManageInstrumentCatalog(user?.role);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  useEffect(() => {
    setSelectedIds(user?.instruments?.map((item) => item.id) ?? []);
  }, [user?.id, user?.instruments]);

  const loadInstruments = async () => {
    try {
      setInstrumentsError(null);
      setInstrumentsLoading(true);
      const [instruments, currentMember] = await Promise.all([
        instrumentService.getInstruments(),
        memberService.getCurrentMember(),
      ]);
      setAvailableInstruments(instruments);
      setSelectedIds(currentMember.instruments?.map((item) => item.id) ?? []);
      await updateCurrentUser({
        id: currentMember.id,
        name: currentMember.name,
        email: currentMember.email,
        role: currentMember.role,
        tenantId: currentMember.tenantId,
        instruments: currentMember.instruments ?? [],
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
    const nextIds = selectedSet.has(instrumentId)
      ? selectedIds.filter((id) => id !== instrumentId)
      : [...selectedIds, instrumentId];

    setSelectedIds(nextIds);

    try {
      const result = await instrumentService.updateMyInstruments(nextIds);
      setSelectedIds(result.instruments.map((item) => item.id));
      await updateCurrentUser({ instruments: result.instruments });
    } catch (error) {
      setSelectedIds(previousIds);
      showInstrumentError(error instanceof Error ? error.message : "Não foi possível atualizar instrumentos.");
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
            <Text style={styles.instrumentMuted}>Nenhum instrumento disponível</Text>
          ) : (
            <View style={styles.instrumentList}>
              {availableInstruments.map((instrument) => {
                const selected = selectedSet.has(instrument.id);
                return (
                  <TouchableOpacity
                    key={instrument.id}
                    style={[
                      styles.instrumentChip,
                      selected && {
                        backgroundColor: instrument.colorHex ?? colors.primary,
                        borderColor: instrument.colorHex ?? colors.primary,
                      },
                    ]}
                    onPress={() => void handleToggleInstrument(instrument.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${selected ? "Remover" : "Adicionar"} ${instrument.name}`}
                    testID={`instrument-toggle-${instrument.id}`}
                  >
                    <Text style={[styles.instrumentChipText, selected && styles.instrumentChipTextSelected]}>
                      {instrument.name}
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
    TENANT_ADMIN: "Líder da igreja",
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
  instrumentLoading: {
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  instrumentMuted: { color: colors.muted, fontSize: 14, fontWeight: "600" },
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
  instrumentChipText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  instrumentChipTextSelected: { color: colors.surface },
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
