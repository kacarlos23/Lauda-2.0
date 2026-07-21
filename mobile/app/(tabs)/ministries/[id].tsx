import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { CheckCircle2, Edit2, Plus, Trash2, User as UserIcon } from "lucide-react-native";
import { BottomSheet } from "../../../src/components/BottomSheet";
import { Button, EmptyState, ErrorBanner, LoadingState, RichCommentEditor, RichCommentView } from "../../../src/components/ui";
import { ministryApi } from "../../../src/services/ministryApi";
import { memberService } from "../../../src/services/memberService";
import { useAuthStore } from "../../../src/store/authStore";
import { useMinistryStore } from "../../../src/store/ministryStore";
import { colors, radii, screen, spacing } from "../../../src/theme";
import { Member } from "../../../src/types";
import { toggleLinkedMemberIds, sortMembersForToggle } from "../../../src/utils/ministryMemberToggle";
import { can } from "../../../src/utils/permissions";
import { AppBackButton } from "../../../src/components/AppBackButton";
import { goBackTo } from "../../../src/utils/navigation";

export default function MinistryDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    currentMinistry: ministry,
    currentMembers: members,
    loading,
    error,
    fetchMinistry,
    updateMinistry,
    deleteMinistry,
    clearError,
  } = useMinistryStore();

  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editComments, setEditComments] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [linkedMemberIds, setLinkedMemberIds] = useState<string[]>([]);
  const [pendingMemberIds, setPendingMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [toggleError, setToggleError] = useState<string | null>(null);

  const canEditMinistry = can(user, "ministry:edit");
  const canDeleteMinistry = can(user, "ministry:delete");
  const canAssignMembers = can(user, "ministry:assign_members");

  const loadAllMembers = useCallback(async () => {
    if (!canAssignMembers) {
      setAllMembers([]);
      return;
    }

    try {
      const tenantMembers = await memberService.listMembers();
      setAllMembers(tenantMembers);
    } catch (error) {
      setToggleError(error instanceof Error ? error.message : "Não foi possível carregar os membros.");
    }
  }, [canAssignMembers]);

  useFocusEffect(
    useCallback(() => {
      if (id) {
        fetchMinistry(id);
        loadAllMembers();
      }
    }, [id, fetchMinistry, loadAllMembers])
  );

  useEffect(() => {
    setLinkedMemberIds(members.map((member) => member.userId));
  }, [members]);

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    const visible = query
      ? allMembers.filter((member) => {
          const haystack = `${member.name} ${member.email ?? ""} ${member.phone ?? ""}`.toLowerCase();
          return haystack.includes(query);
        })
      : allMembers;

    return sortMembersForToggle(visible, linkedMemberIds);
  }, [allMembers, linkedMemberIds, memberSearch]);

  const openEdit = () => {
    if (!ministry) return;
    clearError();
    setFormError(null);
    setEditName(ministry.name);
    setEditDescription(ministry.description ?? "");
    setEditComments(ministry.comments ?? "");
    setShowEdit(true);
  };

  const closeEdit = () => {
    if (submitting) return;
    setShowEdit(false);
  };

  const handleUpdate = async () => {
    if (!id) return;

    const trimmedName = editName.trim();
    const trimmedDescription = editDescription.trim();

    if (trimmedName.length < 2) {
      setFormError("Informe um nome com ao menos 2 caracteres.");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    await updateMinistry(id, {
      name: trimmedName,
      description: trimmedDescription || undefined,
      comments: editComments || null,
    });
    setSubmitting(false);

    if (!useMinistryStore.getState().error) {
      setShowEdit(false);
    }
  };

  const handleDelete = () => {
    if (!id || deleting) return;

    Alert.alert(
      "Excluir ministério",
      "Tem certeza que deseja excluir este ministério? Esta ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            await deleteMinistry(id);
            const deleteError = useMinistryStore.getState().error;
            setDeleting(false);
            if (!deleteError) {
              goBackTo(router, "/ministries");
            }
          },
        },
      ]
    );
  };

  const handleToggleMember = async (memberId: string) => {
    if (!id || pendingMemberIds.includes(memberId)) return;

    const previousIds = linkedMemberIds;
    const wasLinked = previousIds.includes(memberId);
    const nextIds = toggleLinkedMemberIds(previousIds, memberId);
    setToggleError(null);
    setLinkedMemberIds(nextIds);
    setPendingMemberIds((current) => [...current, memberId]);

    try {
      const response = await ministryApi.toggleMinistryMember(id, memberId);
      setLinkedMemberIds((current) => {
        const hasMember = current.includes(memberId);
        if (response.status === "linked" && !hasMember) return [...current, memberId];
        if (response.status === "unlinked" && hasMember) return current.filter((currentId) => currentId !== memberId);
        return current;
      });
      await fetchMinistry(id);
    } catch {
      setLinkedMemberIds((current) => {
        const currentlyLinked = current.includes(memberId);
        if (wasLinked && !currentlyLinked) return [...current, memberId];
        if (!wasLinked && currentlyLinked) return current.filter((currentId) => currentId !== memberId);
        return current;
      });
      setToggleError("Não foi possível atualizar o vínculo. Tente novamente.");
    } finally {
      setPendingMemberIds((current) => current.filter((currentId) => currentId !== memberId));
    }
  };

  if (loading && !ministry) {
    return <LoadingState message="Carregando ministério..." />;
  }

  if (error || !ministry) {
    return (
      <View style={styles.center}>
        <ErrorBanner
          message={error || "Ministério não encontrado"}
          style={styles.errorText}
          action={id ? <Button title="Tentar novamente" variant="secondary" onPress={() => fetchMinistry(id)} /> : undefined}
        />
        <AppBackButton href="/ministries" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <View style={styles.topBar}>
        <AppBackButton href="/ministries" compact />

        {canEditMinistry || canDeleteMinistry ? (
          <View style={styles.headerActions}>
            {canEditMinistry ? <TouchableOpacity onPress={openEdit} style={styles.iconBtn} accessibilityRole="button">
              <Edit2 color={colors.primary} size={20} />
            </TouchableOpacity> : null}
            {canDeleteMinistry ? <TouchableOpacity onPress={handleDelete} style={styles.iconBtn} disabled={deleting} accessibilityRole="button">
              {deleting ? <ActivityIndicator color={colors.danger} /> : <Trash2 color={colors.danger} size={20} />}
            </TouchableOpacity> : null}
          </View>
        ) : null}
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.ministryInfo}>
            <Text style={styles.title}>{ministry.name}</Text>
            {ministry.description ? <Text style={styles.description}>{ministry.description}</Text> : null}
            {ministry.comments ? <View style={styles.commentsCard}><Text style={styles.commentsTitle}>Comentários</Text><RichCommentView value={ministry.comments} /></View> : null}

            <View style={styles.membersHeader}>
              <Text style={styles.membersTitle}>Membros ({members.length})</Text>
              <TouchableOpacity
                style={styles.membersLink}
                onPress={() => router.push(`/ministries/${id}/members` as never)}
                accessibilityRole="button"
              >
                <Text style={styles.membersLinkText}>Ver lista</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        ListFooterComponent={
          canAssignMembers ? (
            <View style={styles.managementSection}>
              <Text style={styles.managementTitle}>Adicionar membros</Text>
              <ErrorBanner message={toggleError} style={styles.toggleError} />

              <Text style={styles.sectionLabel}>Todos os Membros</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por nome, e-mail ou telefone"
                placeholderTextColor={colors.muted}
                value={memberSearch}
                onChangeText={setMemberSearch}
              />

              {filteredMembers.map((member) => {
                const linked = linkedMemberIds.includes(member.id);
                const pending = pendingMemberIds.includes(member.id);

                return (
                  <View key={member.id} style={styles.toggleRow}>
                    <View style={styles.memberAvatar}>
                      <UserIcon color={linked ? colors.primary : colors.muted} size={20} />
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      {member.email ? <Text style={styles.memberEmail}>{member.email}</Text> : null}
                      {member.phone ? <Text style={styles.memberPhone}>{member.phone}</Text> : null}
                    </View>
                    <TouchableOpacity
                      style={[styles.toggleButton, linked ? styles.toggleButtonLinked : styles.toggleButtonUnlinked]}
                      onPress={() => handleToggleMember(member.id)}
                      disabled={pending}
                      accessibilityRole="button"
                    >
                      {pending ? (
                        <ActivityIndicator color={linked ? colors.primary : colors.surface} />
                      ) : linked ? (
                        <>
                          <CheckCircle2 color={colors.primary} size={16} />
                          <Text style={styles.toggleButtonLinkedText}>Vinculado</Text>
                        </>
                      ) : (
                        <>
                          <Plus color={colors.surface} size={16} />
                          <Text style={styles.toggleButtonText}>Vincular</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.memberCard}>
            <View style={styles.memberAvatar}>
              <UserIcon color={colors.primary} size={20} />
            </View>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{item.user.name}</Text>
              <Text style={styles.memberEmail}>{item.user.email}</Text>
            </View>
            {item.isLeader ? (
              <View style={styles.leaderBadge}>
                <Text style={styles.leaderText}>Líder</Text>
              </View>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            title="Nenhum membro vinculado"
            description="Vincule membros a este ministério para organizar líderes, funções e escalas."
            style={styles.emptyBox}
          />
        }
      />

      <BottomSheet
        isOpen={showEdit}
        onClose={closeEdit}
        onBack={closeEdit}
        title="Editar ministério"
        footer={
          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={closeEdit} disabled={submitting}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, submitting && styles.buttonDisabled]}
              onPress={handleUpdate}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.saveButtonText}>Salvar</Text>}
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
            value={editName}
            onChangeText={(value) => {
              setEditName(value);
              setFormError(null);
            }}
          />
          <Text style={styles.label}>Descrição</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Descreva o objetivo deste ministério"
            placeholderTextColor={colors.muted}
            value={editDescription}
            onChangeText={setEditDescription}
            multiline
            textAlignVertical="top"
          />
          <RichCommentEditor value={editComments} onChange={setEditComments} label="Comentários" placeholder="Orientações e observações sobre o ministério..." testID="ministry-comments-input" />
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
    padding: spacing.xl,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  iconBtn: {
    padding: spacing.sm,
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: screen.contentBottomPadding,
  },
  ministryInfo: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  commentsCard: { marginTop: spacing.md, marginBottom: spacing.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.line, borderRadius: radii.lg, backgroundColor: colors.surfaceMuted },
  commentsTitle: { color: colors.ink, fontSize: 15, fontWeight: "800", marginBottom: spacing.sm },
  membersHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingBottom: spacing.sm,
  },
  membersTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.ink,
  },
  membersLink: {
    minHeight: 34,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  membersLinkText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  memberEmail: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 2,
  },
  memberPhone: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  leaderBadge: {
    backgroundColor: "#FCEBAA",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  leaderText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#8C6A00",
  },
  emptyBox: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 15,
  },
  errorText: {
    color: colors.danger,
    fontSize: 16,
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  backBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  backBtnText: {
    color: colors.surface,
    fontWeight: "800",
  },
  managementSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  managementTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: spacing.md,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: spacing.sm,
    textTransform: "uppercase",
  },
  searchInput: {
    minHeight: 46,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.ink,
    fontSize: 15,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  toggleButton: {
    minHeight: 38,
    minWidth: 112,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  toggleButtonUnlinked: {
    backgroundColor: colors.primary,
  },
  toggleButtonLinked: {
    backgroundColor: colors.primarySoft,
  },
  toggleButtonText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "800",
  },
  toggleButtonLinkedText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  toggleError: {
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
    marginBottom: spacing.md,
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
  mutedText: { color: colors.muted, fontSize: 15, lineHeight: 22 },
});
