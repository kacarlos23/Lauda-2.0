import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Edit2, Plus, Trash2, User as UserIcon } from "lucide-react-native";
import { useMinistryStore } from "../../../src/store/ministryStore";
import { useAuthStore } from "../../../src/store/authStore";
import { colors, radii, shadow, spacing } from "../../../src/theme";
import { BottomSheet } from "../../../src/components/BottomSheet";

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
    deleteMinistry,
  } = useMinistryStore();

  const [showEdit, setShowEdit] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (id) {
        fetchMinistry(id);
      }
    }, [id, fetchMinistry])
  );

  const isAdmin = user?.role === "TENANT_ADMIN" || user?.role === "GLOBAL_ADMIN";
  const isMinistryLeader = members.some((m) => m.userId === user?.id && m.isLeader);
  
  const canManageMinistry = isAdmin;
  const canManageMembers = isAdmin || isMinistryLeader;

  const handleDelete = () => {
    Alert.alert(
      "Excluir Ministério",
      "Tem certeza que deseja excluir este ministério? Esta ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            if (id) {
              await deleteMinistry(id);
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
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft color={colors.ink} size={24} />
        </TouchableOpacity>
        
        {canManageMinistry && (
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setShowEdit(true)} style={styles.iconBtn}>
              <Edit2 color={colors.primary} size={20} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} style={styles.iconBtn}>
              <Trash2 color={colors.danger} size={20} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.ministryInfo}>
            <Text style={styles.title}>{ministry.name}</Text>
            {ministry.description ? (
              <Text style={styles.description}>{ministry.description}</Text>
            ) : null}
            
            <View style={styles.membersHeader}>
              <Text style={styles.membersTitle}>Membros ({members.length})</Text>
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
            {item.isLeader && (
              <View style={styles.leaderBadge}>
                <Text style={styles.leaderText}>ðŸ‘‘ Líder</Text>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Nenhum membro vinculado a este ministério.</Text>
          </View>
        }
      />

      {canManageMembers && (
        <TouchableOpacity 
          style={styles.fab} 
          activeOpacity={0.8}
          onPress={() => setShowAddMember(true)}
        >
          <Plus color={colors.surface} size={24} />
        </TouchableOpacity>
      )}

      {/* Edit Ministry BottomSheet */}
      <BottomSheet 
        isOpen={showEdit} 
        onClose={() => setShowEdit(false)} 
        title="Editar Ministério"
      >
        <View style={{ padding: spacing.xl }}>
          <Text style={{ color: colors.text }}>Formulário de edição virá aqui</Text>
        </View>
      </BottomSheet>

      {/* Add Member BottomSheet */}
      <BottomSheet 
        isOpen={showAddMember} 
        onClose={() => setShowAddMember(false)} 
        title="Adicionar Membro"
      >
        <View style={{ padding: spacing.xl }}>
          <Text style={{ color: colors.text }}>Busca de membros virá aqui</Text>
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
});
