import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useRouter } from "expo-router";
import { Copy, RefreshCw, Plus, Users } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { MemberInvite, memberService } from "../../../src/services/memberService";
import { ministryApi } from "../../../src/services/ministryApi";
import { useAuthStore } from "../../../src/store/authStore";
import { Member, Ministry } from "../../../src/types";
import { colors, radii, screen, shadow, spacing } from "../../../src/theme";
import { canManageMembers, canViewMembers } from "../../../src/utils/permissions";

function formatRole(role: string) {
  const labels: Record<string, string> = {
    GLOBAL_ADMIN: "Admin global",
    TENANT_ADMIN: "Líder da igreja",
    MINISTRY_LEADER: "Líder de ministério",
    MEMBER: "Membro",
  };
  return labels[role] ?? role;
}

function formatMinistries(member: Member): string {
  if (!member.ministries?.length) return "Sem ministérios vinculados";

  return member.ministries
    .map((item) => `${item.ministry.name}${item.isLeader ? " (líder)" : ""}`)
    .join(", ");
}

function readableTextColor(backgroundColor?: string | null): string {
  if (!backgroundColor || !/^#[0-9A-Fa-f]{6}$/.test(backgroundColor)) return colors.primaryDark;

  const red = parseInt(backgroundColor.slice(1, 3), 16);
  const green = parseInt(backgroundColor.slice(3, 5), 16);
  const blue = parseInt(backgroundColor.slice(5, 7), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? colors.ink : colors.surface;
}

export default function MembersScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<MemberInvite | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [selectedMinistryId, setSelectedMinistryId] = useState<string>("");
  const canManage = canManageMembers(user?.role);

  const loadMembers = useCallback(async () => {
    try {
      setError(null);
      const data = await memberService.listMembers();
      setMembers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os membros.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInvite = useCallback(async (ministryId = selectedMinistryId) => {
    if (!canManage) return;

    try {
      setInviteLoading(true);
      const data = await memberService.getMemberInvite(ministryId || undefined);
      setInvite(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o convite.");
    } finally {
      setInviteLoading(false);
    }
  }, [canManage, selectedMinistryId]);

  const loadMinistries = useCallback(async () => {
    if (!canManage) return;

    try {
      const data = await ministryApi.getMinistries();
      setMinistries(data);
    } catch {
      setMinistries([]);
    }
  }, [canManage]);

  useEffect(() => {
    loadMembers();
    if (canManage) {
      loadMinistries();
      loadInvite();
    }
  }, [canManage, loadInvite, loadMembers, loadMinistries]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMembers();
    if (canManage) {
      await loadMinistries();
      await loadInvite();
    }
    setRefreshing(false);
  }, [canManage, loadInvite, loadMembers, loadMinistries]);

  const inviteLink = invite?.inviteLink ?? (invite ? `lauda://member-register?code=${invite.code}` : "");

  const handleCopyText = async (value: string, title: string, message: string) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    Alert.alert(title, message);
  };

  const handleCopyInvite = async () => {
    if (!inviteLink) return;

    await handleCopyText(inviteLink, "Link copiado", "O link de cadastro foi copiado.");
  };

  const handleCopyCode = async () => {
    if (!invite?.code) return;

    await handleCopyText(invite.code, "Código copiado", "O código de cadastro foi copiado.");
  };

  const handleRegenerateInvite = () => {
    Alert.alert(
      "Regenerar link",
      "O link atual deixará de funcionar. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Regenerar",
          style: "destructive",
          onPress: async () => {
            try {
              setInviteLoading(true);
              const data = await memberService.regenerateMemberInvite(selectedMinistryId || undefined);
              setInvite(data);
            } catch (err) {
              Alert.alert("Erro", err instanceof Error ? err.message : "Não foi possível regenerar o link.");
            } finally {
              setInviteLoading(false);
            }
          },
        },
      ]
    );
  };

  if (!canViewMembers(user?.role)) {
    return <Redirect href="/(tabs)" />;
  }

  if (loading && members.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Membros</Text>
              <Text style={styles.subtitle}>{members.length} pessoa(s) cadastrada(s)</Text>
            </View>
            {canManage ? (
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => router.push("/members/new" as never)}
                accessibilityRole="button"
                accessibilityLabel="Cadastrar membro"
              >
                <Plus color={colors.surface} size={18} strokeWidth={2.4} />
                <Text style={styles.headerButtonText}>Novo</Text>
              </TouchableOpacity>
            ) : null}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {canManage ? <View style={styles.inviteBox}>
              <View style={styles.inviteHeader}>
                <View style={styles.inviteTitleGroup}>
                  <Text style={styles.inviteTitle}>Link de cadastro de membros</Text>
                  <Text style={styles.inviteText}>Escolha um ministério para que o membro entre nele automaticamente.</Text>
                </View>
                {inviteLoading ? <ActivityIndicator color={colors.primary} /> : null}
              </View>
              <View style={styles.ministrySelector}>
                <TouchableOpacity
                  style={[styles.ministryChip, !selectedMinistryId && styles.ministryChipActive]}
                  onPress={() => {
                    setSelectedMinistryId("");
                    loadInvite("");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Convite geral"
                >
                  <Text style={[styles.ministryChipText, !selectedMinistryId && styles.ministryChipTextActive]}>
                    Geral
                  </Text>
                </TouchableOpacity>
                {ministries.map((ministry) => (
                  <TouchableOpacity
                    key={ministry.id}
                    style={[styles.ministryChip, selectedMinistryId === ministry.id && styles.ministryChipActive]}
                    onPress={() => {
                      setSelectedMinistryId(ministry.id);
                      loadInvite(ministry.id);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Convite para ${ministry.name}`}
                  >
                    <Text
                      style={[
                        styles.ministryChipText,
                        selectedMinistryId === ministry.id && styles.ministryChipTextActive,
                      ]}
                    >
                      {ministry.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.inviteField}>
                <Text style={styles.inviteLabel}>Link</Text>
                <Text style={styles.inviteValue} selectable>
                  {inviteLoading && !invite ? "Carregando convite..." : inviteLink || "Convite indisponível"}
                </Text>
              </View>
              <View style={styles.inviteField}>
                <Text style={styles.inviteLabel}>{invite?.ministry ? `Código - ${invite.ministry.name}` : "Código"}</Text>
                <Text style={styles.inviteValue} selectable>
                  {invite?.code ?? "Convite indisponível"}
                </Text>
              </View>
              <View style={styles.inviteActions}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleCopyInvite}
                  disabled={!inviteLink}
                  accessibilityRole="button"
                  accessibilityLabel="Copiar link de cadastro"
                >
                  <Copy color={colors.primary} size={16} strokeWidth={2.4} />
                  <Text style={styles.secondaryButtonText}>Copiar link</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleCopyCode}
                  disabled={!invite?.code}
                  accessibilityRole="button"
                  accessibilityLabel="Copiar código de cadastro"
                >
                  <Copy color={colors.primary} size={16} strokeWidth={2.4} />
                  <Text style={styles.secondaryButtonText}>Copiar código</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleRegenerateInvite}
                  disabled={inviteLoading}
                  accessibilityRole="button"
                  accessibilityLabel="Regenerar link de cadastro"
                >
                  <RefreshCw color={colors.primary} size={16} strokeWidth={2.4} />
                  <Text style={styles.secondaryButtonText}>Regenerar link</Text>
                </TouchableOpacity>
              </View>
            </View> : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Users color={colors.primary} size={28} strokeWidth={2.3} />
            <Text style={styles.emptyTitle}>Nenhum membro cadastrado</Text>
            <Text style={styles.emptyText}>Cadastre pessoas da igreja para organizar equipes e ministérios.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>{item.name[0]?.toUpperCase()}</Text>
            </View>
            <View style={styles.info}>
              <View style={styles.rowTop}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.role}>{formatRole(item.role)}</Text>
              </View>
              <Text style={styles.email}>{item.email}</Text>
              {item.phone ? <Text style={styles.phone}>{item.phone}</Text> : null}
              <Text style={styles.ministries}>{formatMinistries(item)}</Text>
              <View style={styles.instrumentSection}>
                <Text style={styles.instrumentTitle}>Instrumentos/Cargos</Text>
                {item.instruments?.length ? (
                  <View style={styles.instrumentList}>
                    {item.instruments.map((instrument) => {
                      const chipColor = instrument.colorHex ?? colors.primarySoft;
                      return (
                        <View
                          key={instrument.id}
                          style={[
                            styles.instrumentChip,
                            {
                              backgroundColor: chipColor,
                              borderColor: instrument.colorHex ?? colors.line,
                            },
                          ]}
                        >
                          <Text style={[styles.instrumentChipText, { color: readableTextColor(instrument.colorHex) }]}>
                            {instrument.name}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.noInstruments}>Nenhum instrumento informado</Text>
                )}
              </View>
            </View>
          </View>
        )}
      />
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
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  title: { fontSize: 28, fontWeight: "800", color: colors.ink, marginBottom: spacing.xs },
  subtitle: { fontSize: 15, color: colors.muted },
  headerButton: {
    minHeight: 44,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  headerButtonText: { color: colors.surface, fontSize: 14, fontWeight: "800" },
  errorText: {
    width: "100%",
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  inviteBox: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    ...shadow,
  },
  inviteHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  inviteTitleGroup: { flex: 1 },
  inviteTitle: { color: colors.ink, fontSize: 16, fontWeight: "800", marginBottom: spacing.xs },
  inviteText: { color: colors.text, fontSize: 13, lineHeight: 19 },
  ministrySelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  ministryChip: {
    minHeight: 36,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  ministryChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  ministryChipText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  ministryChipTextActive: { color: colors.primary },
  inviteField: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  inviteLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  inviteValue: { color: colors.ink, fontSize: 13, lineHeight: 19 },
  inviteActions: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  secondaryButton: {
    minHeight: 40,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
  },
  secondaryButtonText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.lg,
  },
  avatarLetter: { color: colors.primaryDark, fontSize: 20, fontWeight: "800" },
  info: { flex: 1 },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  name: { flex: 1, fontSize: 16, fontWeight: "800", color: colors.ink, marginBottom: spacing.xs },
  email: { fontSize: 13, color: colors.muted, marginBottom: spacing.xs },
  phone: { fontSize: 13, color: colors.text, marginBottom: spacing.xs },
  role: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "800",
    textTransform: "uppercase",
    textAlign: "right",
  },
  ministries: { fontSize: 13, color: colors.text, lineHeight: 19 },
  instrumentSection: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  instrumentTitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  instrumentList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  instrumentChip: {
    minHeight: 28,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  instrumentChipText: {
    fontSize: 12,
    fontWeight: "800",
  },
  noInstruments: { color: colors.muted, fontSize: 12, fontWeight: "600" },
});
