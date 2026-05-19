import { useCallback, useState } from "react";
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
import { ArrowLeft, Edit2, Plus, Trash2, User as UserIcon } from "lucide-react-native";
import { BottomSheet } from "../../../src/components/BottomSheet";
import { useAuthStore } from "../../../src/store/authStore";
import { useMinistryStore } from "../../../src/store/ministryStore";
import { colors, radii, shadow, spacing } from "../../../src/theme";

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
  const [showAddMember, setShowAddMember] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (id) {
        fetchMinistry(id);
      }
    }, [id, fetchMinistry])
  );

  const isAdmin = user?.role === "TENANT_ADMIN" || user?.role === "GLOBAL_ADMIN";
  const isMinistryLeader = members.some((member) => member.userId === user?.id && member.isLeader);
  const canManageMinistry = isAdmin;
  const canManageMembers = isAdmin || isMinistryLeader;

  const openEdit = () => {
    if (!ministry) return;
    clearError();
    setFormError(null);
    setEditName(ministry.name);
    setEditDescription(ministry.description ?? "");
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
              router.back();
            }
          },
        },
      ]
    );
  };

  if (loading && !ministry) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !ministry) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || "Ministério não encontrado"}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} accessibilityRole="button">
          <ArrowLeft color={colors.ink} size={24} />
        </TouchableOpacity>

        {canManageMinistry ? (
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={openEdit} style={styles.iconBtn} accessibilityRole="button">
              <Edit2 color={colors.primary} size={20} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} style={styles.iconBtn} disabled={deleting} accessibilityRole="button">
              {deleting ? <ActivityIndicator color={colors.danger} /> : <Trash2 color={colors.danger} size={20} />}
            </TouchableOpacity>
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
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Nenhum membro vinculado a este ministério.</Text>
          </View>
        }
      />

      {canManageMembers ? (
        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.8}
          onPress={() => router.push(`/ministries/assign?ministryId=${id}` as never)}
          accessibilityRole="button"
        >
          <Plus color={colors.surface} size={24} />
        </TouchableOpacity>
      ) : null}

      <BottomSheet
        isOpen={showEdit}
        onClose={closeEdit}
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
          {formError || error ? <Text style={styles.formError}>{formError ?? error}</Text> : null}
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
        </View>
      </BottomSheet>

      <BottomSheet isOpen={showAddMember} onClose={() => setShowAddMember(false)} title="Adicionar membro">
        <View style={styles.form}>
          <Text style={styles.mutedText}>Use a tela de atribuicao para informar usuario, cargo, habilidades e status.</Text>
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
    paddingBottom: 100,
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
    borderRadius: radii.sm,
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
  fab: {
    position: "absolute",
    bottom: spacing.xxl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    ...shadow,
  },
  form: { padding: spacing.xl },
  formError: {
    backgroundColor: "#FDECEC",
    borderColor: "#F0B8B8",
    borderWidth: 1,
    borderRadius: radii.sm,
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
    borderRadius: radii.sm,
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
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  cancelButtonText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  saveButton: {
    minHeight: 44,
    minWidth: 96,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  saveButtonText: { color: colors.surface, fontSize: 14, fontWeight: "800" },
  buttonDisabled: { opacity: 0.6 },
  mutedText: { color: colors.muted, fontSize: 15, lineHeight: 22 },
});
