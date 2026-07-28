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
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { Copy, Edit3, RefreshCw, Plus, Save, Users, X } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { MemberInvite, memberService } from "../../../src/services/memberService";
import { ministryApi } from "../../../src/services/ministryApi";
import { useAuthStore } from "../../../src/store/authStore";
import { Member, Ministry, Role } from "../../../src/types";
import { AppInput, Button, Card, Chip, EmptyState, ErrorBanner, FilterButton, FilterPanel, FilterSection, InviteStatusBadge, LoadingState, PermissionStatusBadge, RichCommentEditor, RichCommentView, RoleBadge, Screen, SectionHeader } from "../../../src/components/ui";
import {
  colors,
  controlSizes,
  fontSizes,
  fontWeights,
  iconSizes,
  overlays,
  radii,
  screen,
  shadow,
  spacing,
  typography,
} from "../../../src/theme";
import { buildPublicInviteLink } from "../../../src/utils/memberInvite";
import {
  NO_INSTRUMENT,
  NO_MINISTRY,
  emptyMemberFilters,
  filterMembers,
  hasActiveFilters,
  uniqueMemberInstruments,
  uniqueMemberMinistries,
  MemberListFilters,
} from "../../../src/utils/listFilters";
import { can, canViewMembers, isGlobalAdmin } from "../../../src/utils/permissions";
import { GROUP_HREFS, nav } from "../../../src/navigation/routes";

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
  const [commentMember, setCommentMember] = useState<Member | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [filters, setFilters] = useState<MemberListFilters>(emptyMemberFilters);
  const [draftFilters, setDraftFilters] = useState<MemberListFilters>(emptyMemberFilters);
  const [showFilters, setShowFilters] = useState(false);
  const canCreateMember = can(user, "member:create");
  const canEditMember = can(user, "member:edit");
  const canInviteMember = can(user, "member:invite");
  const canAssignLegacyAccess = isGlobalAdmin(user);
  const canLoadManagementData = canInviteMember || canAssignLegacyAccess;
  const activeFilters = hasActiveFilters(filters);
  const canApplyFilters = hasActiveFilters(draftFilters);
  const ministryFilterOptions = uniqueMemberMinistries(members);
  const instrumentFilterOptions = uniqueMemberInstruments(members);
  const filteredMembers = filterMembers(members, filters);

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
    if (!canInviteMember) return;

    try {
      setInviteLoading(true);
      const data = await memberService.getMemberInvite(ministryId || undefined);
      setInvite(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o convite.");
    } finally {
      setInviteLoading(false);
    }
  }, [canInviteMember, selectedMinistryId]);

  const loadMinistries = useCallback(async () => {
    if (!canLoadManagementData) return;

    try {
      const data = await ministryApi.getMinistries();
      setMinistries(data);
    } catch {
      setMinistries([]);
    }
  }, [canLoadManagementData]);

  useFocusEffect(
    useCallback(() => {
      void loadMembers();
      if (canLoadManagementData) {
        void loadMinistries();
        void loadInvite();
      }
    }, [canLoadManagementData, loadInvite, loadMembers, loadMinistries])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMembers();
    if (canLoadManagementData) {
      await loadMinistries();
      await loadInvite();
    }
    setRefreshing(false);
  }, [canLoadManagementData, loadInvite, loadMembers, loadMinistries]);

  const openFilters = () => {
    setDraftFilters(filters);
    setShowFilters(true);
  };

  const clearFilters = () => {
    setFilters(emptyMemberFilters);
    setDraftFilters(emptyMemberFilters);
    setShowFilters(false);
  };

  const applyFilters = () => {
    if (!hasActiveFilters(draftFilters)) return;
    setFilters(draftFilters);
    setShowFilters(false);
  };

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
      Alert.alert("Acesso atualizado", "O acesso e os vínculos do membro foram alterados.");
    } catch (err) {
      Alert.alert("Erro", err instanceof Error ? err.message : "Não foi possível atualizar o acesso.");
    } finally {
      setSavingPermissions(false);
    }
  };

  const openCommentEditor = (member: Member) => {
    setCommentMember(member);
    setCommentDraft(member.comments ?? "");
  };

  const saveComment = async () => {
    if (!commentMember) return;
    try {
      setSavingComment(true);
      const updated = await memberService.updateMember(commentMember.id, { comments: commentDraft || null });
      setMembers((current) => current.map((member) => member.id === updated.id ? { ...member, ...updated } : member));
      setCommentMember(null);
      setCommentDraft("");
    } catch (reason) {
      Alert.alert("Erro", reason instanceof Error ? reason.message : "Não foi possível salvar os comentários.");
    } finally {
      setSavingComment(false);
    }
  };

  if (!canViewMembers(user)) {
    return <Redirect href={GROUP_HREFS.tabs} />;
  }

  if (loading && members.length === 0) {
    return <LoadingState message="Carregando membros..." />;
  }

  return (
    <Screen padded={false} contentStyle={styles.screenContent}>
      <Modal visible={Boolean(commentMember)} transparent animationType="fade" onRequestClose={() => !savingComment && setCommentMember(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleGroup}><Text style={styles.modalTitle}>Comentários do membro</Text><Text style={styles.modalSubtitle}>{commentMember?.name}</Text></View>
              <TouchableOpacity style={styles.iconButton} onPress={() => setCommentMember(null)} disabled={savingComment} accessibilityLabel="Fechar comentários"><X color={colors.text} size={iconSizes.s18} /></TouchableOpacity>
            </View>
            <RichCommentEditor value={commentDraft} onChange={setCommentDraft} label="Comentários" placeholder="Observações administrativas ou pastorais..." testID="member-comments-input" />
            <Button title={savingComment ? "Salvando..." : "Salvar comentários"} loading={savingComment} disabled={savingComment} onPress={() => void saveComment()} style={styles.commentSaveButton} />
          </View>
        </View>
      </Modal>
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
                <Text style={styles.modalTitle}>Acesso e ministérios</Text>
                <Text style={styles.modalSubtitle}>{editingMember?.name}</Text>
              </View>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={closePermissionEditor}
                accessibilityRole="button"
                accessibilityLabel="Fechar edição de acesso"
              >
                <X color={colors.text} size={iconSizes.s18} />
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
                          <PermissionStatusBadge
                            status={state.selected ? "LINKED" : "UNLINKED"}
                            style={styles.permissionStatusBadge}
                          />
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
                  accessibilityLabel="Salvar acesso"
                >
                  {savingPermissions ? <ActivityIndicator color={colors.surface} /> : <Save color={colors.surface} size={iconSizes.s18} />}
                  <Text style={styles.savePermissionButtonText}>Salvar acesso</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
      <FilterPanel
        visible={showFilters}
        title="Filtrar membros"
        canApply={canApplyFilters}
        onApply={applyFilters}
        onClose={() => setShowFilters(false)}
        onClear={activeFilters || canApplyFilters ? clearFilters : undefined}
      >
        <AppInput
          label="Palavra-chave geral"
          value={draftFilters.query ?? ""}
          onChangeText={(query) => setDraftFilters((current) => ({ ...current, query }))}
          placeholder="Nome, e-mail, ministério ou instrumento"
          accessibilityLabel="Buscar membros"
        />
        <FilterSection title="Ministério">
          <Chip label="Sem ministério" active={draftFilters.ministryId === NO_MINISTRY} onPress={() => setDraftFilters((current) => ({ ...current, ministryId: NO_MINISTRY }))} />
          {ministryFilterOptions.map((ministry) => (
            <Chip key={ministry.id} label={ministry.name} active={draftFilters.ministryId === ministry.id} onPress={() => setDraftFilters((current) => ({ ...current, ministryId: ministry.id }))} />
          ))}
        </FilterSection>
        <FilterSection title="Instrumento/cargo">
          <Chip label="Sem instrumento" active={draftFilters.instrumentId === NO_INSTRUMENT} onPress={() => setDraftFilters((current) => ({ ...current, instrumentId: NO_INSTRUMENT }))} />
          {instrumentFilterOptions.map((instrument) => (
            <Chip key={instrument.id} label={instrument.name} active={draftFilters.instrumentId === instrument.id} onPress={() => setDraftFilters((current) => ({ ...current, instrumentId: instrument.id }))} />
          ))}
        </FilterSection>
        <FilterSection title="Papel">
          {(["MEMBER", "MINISTRY_LEADER", "TENANT_ADMIN", "GLOBAL_ADMIN"] as Role[]).map((role) => (
            <Chip key={role} label={formatRole(role)} active={draftFilters.role === role} onPress={() => setDraftFilters((current) => ({ ...current, role }))} />
          ))}
        </FilterSection>
      </FilterPanel>
      <FlatList
        data={filteredMembers}
        keyExtractor={(item) => item.id}
        style={styles.listScroller}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <SectionHeader
              title="Membros"
              subtitle={activeFilters ? `${filteredMembers.length} de ${members.length} pessoa(s)` : `${members.length} pessoa(s) cadastrada(s)`}
              action={canCreateMember ? (
                <View style={styles.headerActions}>
                  <FilterButton active={activeFilters} onPress={openFilters} accessibilityLabel="Abrir filtros de membros" />
                  <Button
                    title="Novo"
                    icon={<Plus color={colors.surface} size={iconSizes.s18} strokeWidth={2.4} />}
                    onPress={() => router.push(nav.memberNew)}
                    accessibilityLabel="Cadastrar membro"
                  />
                </View>
              ) : (
                <FilterButton active={activeFilters} onPress={openFilters} accessibilityLabel="Abrir filtros de membros" />
              )}
              style={styles.sectionHeader}
            />
            {activeFilters ? <Button title="Limpar filtros" variant="ghost" size="sm" style={styles.clearFiltersButton} onPress={clearFilters} accessibilityLabel="Limpar filtros de membros" /> : null}
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
                  accessibilityLabel="Tentar carregar membros novamente"
                />
              ) : null}
            />
            {canInviteMember ? <Card style={styles.inviteBox}>
              <View style={styles.inviteHeader}>
                <View style={styles.inviteTitleGroup}>
                  <Text style={styles.inviteTitle}>Link de cadastro de membros</Text>
                  <Text style={styles.inviteText}>Escolha um ministério para que o membro entre nele automaticamente.</Text>
                </View>
                <InviteStatusBadge active={invite?.active} loading={inviteLoading} />
                {inviteLoading ? <ActivityIndicator color={colors.primary} /> : null}
              </View>
              <View style={styles.ministrySelector}>
                <Chip
                  label="Geral"
                  active={!selectedMinistryId}
                  onPress={() => {
                    setSelectedMinistryId("");
                    loadInvite("");
                  }}
                  accessibilityLabel="Convite geral"
                />
                {ministries.map((ministry) => (
                  <Chip
                    key={ministry.id}
                    label={ministry.name}
                    active={selectedMinistryId === ministry.id}
                    onPress={() => {
                      setSelectedMinistryId(ministry.id);
                      loadInvite(ministry.id);
                    }}
                    accessibilityLabel={`Convite para ${ministry.name}`}
                  />
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
                <Button
                  title="Copiar link"
                  icon={<Copy color={colors.primary} size={iconSizes.s16} strokeWidth={2.4} />}
                  variant="secondary"
                  size="sm"
                  onPress={handleCopyInvite}
                  disabled={!inviteLink}
                  accessibilityLabel="Copiar link de cadastro"
                />
                <Button
                  title="Copiar código"
                  icon={<Copy color={colors.primary} size={iconSizes.s16} strokeWidth={2.4} />}
                  variant="secondary"
                  size="sm"
                  onPress={handleCopyCode}
                  disabled={!invite?.code}
                  accessibilityLabel="Copiar código de cadastro"
                />
                <Button
                  title="Regenerar link"
                  icon={<RefreshCw color={colors.primary} size={iconSizes.s16} strokeWidth={2.4} />}
                  variant="secondary"
                  size="sm"
                  onPress={handleRegenerateInvite}
                  disabled={inviteLoading}
                  accessibilityLabel="Regenerar link de cadastro"
                />
              </View>
            </Card> : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon={<Users color={colors.primary} size={iconSizes.s28} strokeWidth={2.3} />}
            title={activeFilters ? "Nenhum membro encontrado" : "Nenhum membro cadastrado"}
            description={activeFilters ? "Ajuste ou limpe os filtros para ver outros membros." : "Cadastre pessoas da igreja para organizar equipes e ministérios."}
            action={canCreateMember ? (
              activeFilters ? (
                <Button title="Limpar filtros" variant="secondary" onPress={() => setFilters(emptyMemberFilters)} accessibilityLabel="Limpar filtros de membros" />
              ) : (
                <Button
                  title="Cadastrar membro"
                  onPress={() => router.push(nav.memberNew)}
                  accessibilityLabel="Cadastrar membro"
                />
              )
            ) : null}
          />
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>{item.name[0]?.toUpperCase()}</Text>
            </View>
            <View style={styles.info}>
              <View style={styles.rowTop}>
                <Text style={styles.name}>{item.name}</Text>
                <RoleBadge status={item.role} label={formatRole(item.role)} style={styles.role} textStyle={styles.roleText} />
              </View>
              <Text style={styles.ministries}>{formatMinistries(item)}</Text>
              {item.comments ? <View style={styles.memberComments}><RichCommentView value={item.comments} numberOfLines={4} /></View> : null}
              {canEditMember ? <Button title="Comentários" variant="secondary" size="sm" style={styles.permissionButton} onPress={() => openCommentEditor(item)} accessibilityLabel={`Editar comentários de ${item.name}`} /> : null}
              {canAssignLegacyAccess && item.id !== user?.id ? (
                <Button
                  title="Acesso"
                  icon={<Edit3 color={colors.primary} size={iconSizes.s15} strokeWidth={2.4} />}
                  variant="secondary"
                  size="sm"
                  style={styles.permissionButton}
                  onPress={() => openPermissionEditor(item)}
                  accessibilityLabel={`Editar acesso de ${item.name}`}
                />
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
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  commentSaveButton: { marginTop: spacing.lg },
  memberComments: { marginTop: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
  screenContent: {
    flex: 1,
    maxWidth: "100%",
  },
  listScroller: {
    flex: 1,
    width: "100%",
  },
  list: {
    width: "100%",
    maxWidth: screen.listMaxWidth,
    alignSelf: "center",
    padding: spacing.xl,
    paddingBottom: screen.contentBottomPadding,
  },
  header: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  sectionHeader: { width: "100%", marginBottom: 0 },
  headerActions: { flexDirection: "row", gap: spacing.sm, alignItems: "center", flexWrap: "wrap" },
  errorText: {
    width: "100%",
  },
  retryButton: { alignSelf: "flex-start" },
  clearFiltersButton: { alignSelf: "flex-start" },
  inviteBox: {
    width: "100%",
    padding: spacing.lg,
  },
  inviteHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  inviteTitleGroup: { flex: 1 },
  inviteTitle: { ...typography.cardTitle, color: colors.ink, marginBottom: spacing.xs },
  inviteText: { ...typography.metadata, color: colors.text },
  ministrySelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  inviteField: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  inviteLabel: {
    ...typography.badge,
    color: colors.muted,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  inviteValue: { ...typography.metadata, color: colors.ink },
  label: { ...typography.label, color: colors.text, marginBottom: spacing.sm },
  inviteActions: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  card: {
    padding: spacing.lg,
    marginBottom: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  avatar: {
    width: controlSizes.large,
    height: controlSizes.large,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.lg,
  },
  avatarLetter: { color: colors.primaryDark, fontSize: fontSizes.s20, fontWeight: fontWeights.bold },
  info: { flex: 1 },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  name: { ...typography.cardTitle, flex: 1, color: colors.ink, marginBottom: spacing.xs },
  role: {
    alignSelf: "flex-start",
  },
  roleText: {
    ...typography.badge,
    textTransform: "uppercase",
    textAlign: "right",
  },
  ministries: { ...typography.metadata, color: colors.text },
  instrumentSection: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  instrumentTitle: {
    ...typography.badge,
    color: colors.muted,
    textTransform: "uppercase",
  },
  instrumentList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  instrumentChip: {
    minHeight: 28,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  instrumentChipText: {
    ...typography.badge,
  },
  noInstruments: { ...typography.badge, color: colors.muted, fontWeight: fontWeights.regular },
  permissionButton: {
    alignSelf: "flex-start",
    minHeight: 34,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: overlays.modalCool,
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
  modalTitle: { ...typography.sectionTitle, color: colors.ink, marginBottom: spacing.xs },
  modalSubtitle: { ...typography.metadata, color: colors.muted },
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
    minHeight: controlSizes.default,
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
  roleOptionText: { ...typography.label, color: colors.text },
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
  permissionMinistryName: { ...typography.label, color: colors.ink },
  permissionMinistryStatus: { ...typography.badge, color: colors.muted, fontWeight: fontWeights.regular, marginTop: spacing.xxs },
  permissionStatusBadge: { marginTop: spacing.xs },
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
  leaderToggleText: { ...typography.badge, color: colors.text },
  leaderToggleTextActive: { color: colors.surface },
  savePermissionButton: {
    minHeight: controlSizes.large,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  savePermissionButtonDisabled: { opacity: 0.65 },
  savePermissionButtonText: { ...typography.button, color: colors.surface },
});
