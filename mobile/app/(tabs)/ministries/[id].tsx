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
import {
  colors,
  controlSizes,
  fontSizes,
  fontWeights,
  iconSizes,
  lineHeights,
  radii,
  radiusValues,
  screen,
  spacing,
} from "../../../src/theme";
import { Member } from "../../../src/types";
import { toggleLinkedMemberIds, sortMembersForToggle } from "../../../src/utils/ministryMemberToggle";
import { can } from "../../../src/utils/permissions";
import { AppBackButton } from "../../../src/components/AppBackButton";
import { goBackTo } from "../../../src/utils/navigation";
import { nav } from "../../../src/navigation/routes";

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
              goBackTo(router, nav.ministries);
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
        <AppBackButton href={nav.ministries} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <View style={styles.topBar}>
        <AppBackButton href={nav.ministries} compact />

        {canEditMinistry || canDeleteMinistry ? (
          <View style={styles.headerActions}>
            {canEditMinistry ? <TouchableOpacity onPress={openEdit} style={styles.iconBtn} accessibilityRole="button">
              <Edit2 color={colors.primary} size={iconSizes.s20} />
            </TouchableOpacity> : null}
            {canDeleteMinistry ? <TouchableOpacity onPress={handleDelete} style={styles.iconBtn} disabled={deleting} accessibilityRole="button">
              {deleting ? <ActivityIndicator color={colors.danger} /> : <Trash2 color={colors.danger} size={iconSizes.s20} />}
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
                onPress={() => router.push(nav.ministryMembers(id))}
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
                      <UserIcon color={linked ? colors.primary : colors.muted} size={iconSizes.s20} />
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
                          <CheckCircle2 color={colors.primary} size={iconSizes.s16} />
                          <Text style={styles.toggleButtonLinkedText}>Vinculado</Text>
                        </>
                      ) : (
                        <>
                          <Plus color={colors.surface} size={iconSizes.s16} />
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
              <UserIcon color={colors.primary} size={iconSizes.s20} />
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
    width: "100%",
    maxWidth: screen.listMaxWidth,
    alignSelf: "center",
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
    width: "100%",
    maxWidth: screen.listMaxWidth,
    alignSelf: "center",
    padding: spacing.xl,
    paddingBottom: screen.contentBottomPadding,
  },
  ministryInfo: {
    marginBottom: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  title: {
    fontSize: fontSizes.s32,
    fontWeight: fontWeights.extrabold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: fontSizes.s16,
    color: colors.text,
    lineHeight: lineHeights.h24,
    marginBottom: spacing.lg,
  },
  commentsCard: { marginTop: spacing.md, marginBottom: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.line },
  commentsTitle: { color: colors.ink, fontSize: fontSizes.s13, fontWeight: fontWeights.extrabold, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: spacing.sm },
  membersHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  membersTitle: {
    fontSize: fontSizes.s18,
    fontWeight: fontWeights.extrabold,
    color: colors.ink,
  },
  membersLink: {
    minHeight: controlSizes.default,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  membersLinkText: {
    color: colors.primary,
    fontSize: fontSizes.s13,
    fontWeight: fontWeights.extrabold,
  },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  memberAvatar: {
    width: controlSizes.medium,
    height: controlSizes.medium,
    borderRadius: radiusValues.r20,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: fontSizes.s16,
    fontWeight: fontWeights.bold,
    color: colors.ink,
  },
  memberEmail: {
    fontSize: fontSizes.s14,
    color: colors.muted,
    marginTop: spacing.xxs,
  },
  memberPhone: {
    fontSize: fontSizes.s13,
    color: colors.muted,
    marginTop: spacing.xxs,
  },
  leaderBadge: {
    backgroundColor: colors.warningHighlight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  leaderText: {
    fontSize: fontSizes.s12,
    fontWeight: fontWeights.extrabold,
    color: colors.warningStrong,
  },
  emptyBox: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    color: colors.muted,
    fontSize: fontSizes.s15,
  },
  errorText: {
    color: colors.danger,
    fontSize: fontSizes.s16,
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
    fontWeight: fontWeights.extrabold,
  },
  managementSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  managementTitle: {
    color: colors.ink,
    fontSize: fontSizes.s20,
    fontWeight: fontWeights.extrabold,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: fontSizes.s13,
    fontWeight: fontWeights.extrabold,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
  },
  searchInput: {
    minHeight: controlSizes.default,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.ink,
    fontSize: fontSizes.s15,
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
    minHeight: controlSizes.default,
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
    fontSize: fontSizes.s13,
    fontWeight: fontWeights.extrabold,
  },
  toggleButtonLinkedText: {
    color: colors.primary,
    fontSize: fontSizes.s13,
    fontWeight: fontWeights.extrabold,
  },
  toggleError: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radii.md,
    color: colors.danger,
    fontSize: fontSizes.s14,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.h20,
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
    fontSize: fontSizes.s14,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.h20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  label: { color: colors.text, fontSize: fontSizes.s13, fontWeight: fontWeights.extrabold, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.ink,
    fontSize: fontSizes.s15,
    paddingHorizontal: spacing.lg,
    minHeight: controlSizes.default,
    paddingVertical: spacing.control,
    marginBottom: spacing.md,
  },
  textArea: { minHeight: 104 },
  sheetActions: {
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "flex-end",
  },
  cancelButton: {
    minHeight: controlSizes.default,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  cancelButtonText: { color: colors.text, fontSize: fontSizes.s14, fontWeight: fontWeights.extrabold },
  saveButton: {
    minHeight: controlSizes.default,
    minWidth: 96,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  saveButtonText: { color: colors.surface, fontSize: fontSizes.s14, fontWeight: fontWeights.extrabold },
  buttonDisabled: { opacity: 0.6 },
  mutedText: { color: colors.muted, fontSize: fontSizes.s15, lineHeight: lineHeights.h22 },
});
