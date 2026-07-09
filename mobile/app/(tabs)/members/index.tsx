import { useCallback, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { Copy, Edit3, RefreshCw, Plus, Save, Users, X } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { MemberInvite, memberService } from "../../../src/services/memberService";
import { ministryApi } from "../../../src/services/ministryApi";
import { useAuthStore } from "../../../src/store/authStore";
import { Member, Ministry, Role } from "../../../src/types";
import { colors, radii, screen, shadow, spacing } from "../../../src/theme";
import { buildPublicInviteLink } from "../../../src/utils/memberInvite";
import { canManageMembers, canViewMembers } from "../../../src/utils/permissions";

type EditableRole = Extract<Role, "MEMBER" | "MINISTRY_LEADER" | "TENANT_ADMIN">;

type PermissionDraft = {
  role: EditableRole;
  ministries: Record<string, { selected: boolean; isLeader: boolean }>;
};

function formatRole(role: string) {
  const labels: Record<string, string> = {
    GLOBAL_ADMIN: "Administrador global",
    TENANT_ADMIN: "Administrador da igreja",
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

function confirmRegenerateInvite(onConfirm: () => void) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    if (window.confirm("O link atual deixará de funcionar. Deseja continuar?")) {
      onConfirm();
    }
    return;
  }

  Alert.alert(
    "Regenerar link",
    "O link atual deixará de funcionar. Deseja continuar?",
    [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Regenerar",
        style: "destructive",
        onPress: onConfirm,
      },
    ]
  );
}

function buildPermissionDraft(member: Member, ministries: Ministry[]): PermissionDraft {
  const currentMinistries = new Map(member.ministries.map((item) => [item.ministry.id, item]));
  const role = member.role === "TENANT_ADMIN" || member.role === "MINISTRY_LEADER" ? member.role : "MEMBER";

  return {
    role,
    ministries: Object.fromEntries(
      ministries.map((ministry) => {
        const current = currentMinistries.get(ministry.id);
        return [ministry.id, { selected: Boolean(current), isLeader: Boolean(current?.isLeader) }];
      })
    ),
  };
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
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [permissionDraft, setPermissionDraft] = useState<PermissionDraft | null>(null);
  const [savingPermissions, setSavingPermissions] = useState(false);
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

  useFocusEffect(
    useCallback(() => {
      void loadMembers();
      if (canManage) {
        void loadMinistries();
        void loadInvite();
      }
    }, [canManage, loadInvite, loadMembers, loadMinistries])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMembers();
    if (canManage) {
      await loadMinistries();
      await loadInvite();
    }
    setRefreshing(false);
  }, [canManage, loadInvite, loadMembers, loadMinistries]);

  const inviteLink = buildPublicInviteLink(invite);

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
    confirmRegenerateInvite(async () => {
      try {
        setInviteLoading(true);
        const data = await memberService.regenerateMemberInvite(selectedMinistryId || undefined);
        setInvite(data);
      } catch (err) {
        Alert.alert("Erro", err instanceof Error ? err.message : "Não foi possível regenerar o link.");
      } finally {
        setInviteLoading(false);
      }
    });
  };

  const openPermissionEditor = (member: Member) => {
    setEditingMember(member);
    setPermissionDraft(buildPermissionDraft(member, ministries));
  };

  const closePermissionEditor = () => {
    if (savingPermissions) return;
    setEditingMember(null);
    setPermissionDraft(null);
  };

  const setDraftRole = (role: EditableRole) => {
    setPermissionDraft((current) => current ? { ...current, role } : current);
  };

  const toggleDraftMinistry = (ministryId: string) => {
    setPermissionDraft((current) => {
      if (!current) return current;
      const currentMinistry = current.ministries[ministryId] ?? { selected: false, isLeader: false };
      const selected = !currentMinistry.selected;
      return {
        ...current,
        ministries: {
          ...current.ministries,
          [ministryId]: {
            selected,
            isLeader: selected ? currentMinistry.isLeader : false,
          },
        },
      };
    });
  };

  const toggleDraftLeader = (ministryId: string) => {
    setPermissionDraft((current) => {
      if (!current) return current;
      const currentMinistry = current.ministries[ministryId] ?? { selected: false, isLeader: false };
      return {
        ...current,
        ministries: {
          ...current.ministries,
          [ministryId]: {
            selected: true,
            isLeader: !currentMinistry.isLeader,
          },
        },
      };
    });
  };

  const savePermissions = async () => {
    if (!editingMember || !permissionDraft) return;

    const selectedMinistries = Object.entries(permissionDraft.ministries)
      .filter(([, value]) => value.selected)
      .map(([ministryId, value]) => ({ ministryId, isLeader: value.isLeader }));

    try {
      setSavingPermissions(true);
      const updated = await memberService.updatePermissions(editingMember.id, {
        role: permissionDraft.role,
        ministries: selectedMinistries,
      });
      setMembers((current) => current.map((member) => member.id === updated.id ? updated : member));
      setEditingMember(null);
      setPermissionDraft(null);
      Alert.alert("Permissões atualizadas", "As permissões do membro foram alteradas.");
    } catch (err) {
      Alert.alert("Erro", err instanceof Error ? err.message : "Não foi possível atualizar as permissões.");
    } finally {
      setSavingPermissions(false);
    }
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
      <Modal
        visible={Boolean(editingMember && permissionDraft)}
        transparent
        animationType="fade"
        onRequestClose={closePermissionEditor}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleGroup}>
                <Text style={styles.modalTitle}>Permissões do membro</Text>
                <Text style={styles.modalSubtitle}>{editingMember?.name}</Text>
              </View>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={closePermissionEditor}
                accessibilityRole="button"
                accessibilityLabel="Fechar edição de permissões"
              >
                <X color={colors.text} size={18} />
              </TouchableOpacity>
            </View>

            {permissionDraft ? (
              <>
                <Text style={styles.label}>Nível de acesso</Text>
                <View style={styles.roleSelector}>
                  {(["MEMBER", "MINISTRY_LEADER", "TENANT_ADMIN"] as EditableRole[]).map((role) => {
                    const selected = permissionDraft.role === role;
                    return (
                      <TouchableOpacity
                        key={role}
                        style={[styles.roleOption, selected && styles.roleOptionActive]}
                        onPress={() => setDraftRole(role)}
                        accessibilityRole="button"
                        accessibilityLabel={`Definir como ${formatRole(role)}`}
                      >
                        <Text style={[styles.roleOptionText, selected && styles.roleOptionTextActive]}>
                          {formatRole(role)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>Ministérios e liderança</Text>
                <View style={styles.permissionsMinistryList}>
                  {ministries.length === 0 ? (
                    <Text style={styles.noInstruments}>Nenhum ministério cadastrado.</Text>
                  ) : ministries.map((ministry) => {
                    const state = permissionDraft.ministries[ministry.id] ?? { selected: false, isLeader: false };
                    return (
                      <View key={ministry.id} style={styles.permissionMinistryRow}>
                        <TouchableOpacity
                          style={[styles.permissionMinistryMain, state.selected && styles.permissionMinistryMainActive]}
                          onPress={() => toggleDraftMinistry(ministry.id)}
                          accessibilityRole="button"
                          accessibilityLabel={`Vincular ${editingMember?.name} ao ministério ${ministry.name}`}
                        >
                          <Text style={styles.permissionMinistryName}>{ministry.name}</Text>
                          <Text style={styles.permissionMinistryStatus}>{state.selected ? "Vinculado" : "Sem vínculo"}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.leaderToggle,
                            state.isLeader && styles.leaderToggleActive,
                            !state.selected && styles.leaderToggleDisabled,
                          ]}
                          onPress={() => toggleDraftLeader(ministry.id)}
                          disabled={!state.selected}
                          accessibilityRole="button"
                          accessibilityLabel={`Marcar liderança em ${ministry.name}`}
                        >
                          <Text style={[styles.leaderToggleText, state.isLeader && styles.leaderToggleTextActive]}>
                            Líder
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[styles.savePermissionButton, savingPermissions && styles.savePermissionButtonDisabled]}
                  onPress={savePermissions}
                  disabled={savingPermissions}
                  accessibilityRole="button"
                  accessibilityLabel="Salvar permissões"
                >
                  {savingPermissions ? <ActivityIndicator color={colors.surface} /> : <Save color={colors.surface} size={18} />}
                  <Text style={styles.savePermissionButtonText}>Salvar permissões</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
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
              <Text style={styles.ministries}>{formatMinistries(item)}</Text>
              {canManage && item.id !== user?.id ? (
                <TouchableOpacity
                  style={styles.permissionButton}
                  onPress={() => openPermissionEditor(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Editar permissões de ${item.name}`}
                >
                  <Edit3 color={colors.primary} size={15} strokeWidth={2.4} />
                  <Text style={styles.permissionButtonText}>Permissões</Text>
                </TouchableOpacity>
              ) : null}
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
    paddingBottom: 120,
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
    borderRadius: radii.md,
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
    borderRadius: radii.xl,
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
    borderRadius: radii.md,
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
    borderRadius: radii.md,
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
  label: { color: colors.text, fontSize: 13, fontWeight: "800", marginBottom: spacing.sm },
  inviteActions: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  secondaryButton: {
    minHeight: 40,
    borderRadius: radii.md,
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
    borderRadius: radii.xl,
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
    borderRadius: radii.xl,
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
    borderRadius: radii.md,
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
  permissionButton: {
    alignSelf: "flex-start",
    minHeight: 34,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
  },
  permissionButtonText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.46)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 620,
    maxHeight: "92%",
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
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
  modalTitle: { color: colors.ink, fontSize: 20, fontWeight: "900", marginBottom: spacing.xs },
  modalSubtitle: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  roleSelector: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  roleOption: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  roleOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  roleOptionText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  roleOptionTextActive: { color: colors.primary },
  permissionsMinistryList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  permissionMinistryRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "stretch",
  },
  permissionMinistryMain: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  permissionMinistryMainActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  permissionMinistryName: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  permissionMinistryStatus: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 2 },
  leaderToggle: {
    minWidth: 84,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  leaderToggleActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  leaderToggleDisabled: { opacity: 0.45 },
  leaderToggleText: { color: colors.text, fontSize: 12, fontWeight: "900" },
  leaderToggleTextActive: { color: colors.surface },
  savePermissionButton: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  savePermissionButtonDisabled: { opacity: 0.65 },
  savePermissionButtonText: { color: colors.surface, fontSize: 15, fontWeight: "900" },
});
