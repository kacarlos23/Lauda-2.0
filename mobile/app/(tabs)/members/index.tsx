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
import { MemberInvite, memberService } from "../../../src/services/memberService";
import { useAuthStore } from "../../../src/store/authStore";
import { Member } from "../../../src/types";
import { colors, radii, screen, shadow, spacing } from "../../../src/theme";

function canManageMembers(role?: string): boolean {
  return role === "TENANT_ADMIN" || role === "GLOBAL_ADMIN";
}

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

export default function MembersScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<MemberInvite | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  const loadMembers = useCallback(async () => {
    try {
      setError(null);
      const data = await memberService.listMembers();
      setMembers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possivel carregar os membros.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInvite = useCallback(async () => {
    try {
      setInviteLoading(true);
      const data = await memberService.getMemberInvite();
      setInvite(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possivel carregar o convite.");
    } finally {
      setInviteLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
    loadInvite();
  }, [loadInvite, loadMembers]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMembers();
    await loadInvite();
    setRefreshing(false);
  }, [loadInvite, loadMembers]);

  const inviteLink = invite ? `lauda://member-register?code=${invite.code}` : "";

  const handleCopyInvite = async () => {
    if (!inviteLink) return;

    const clipboard = globalThis.navigator?.clipboard;
    if (clipboard?.writeText) {
      await clipboard.writeText(inviteLink);
      Alert.alert("Link copiado", "O link de cadastro foi copiado.");
      return;
    }

    Alert.alert("Link de cadastro", inviteLink);
  };

  const handleRegenerateInvite = () => {
    Alert.alert(
      "Regenerar link",
      "O link atual deixara de funcionar. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Regenerar",
          style: "destructive",
          onPress: async () => {
            try {
              setInviteLoading(true);
              const data = await memberService.regenerateMemberInvite();
              setInvite(data);
            } catch (err) {
              Alert.alert("Erro", err instanceof Error ? err.message : "Não foi possivel regenerar o link.");
            } finally {
              setInviteLoading(false);
            }
          },
        },
      ]
    );
  };

  if (!canManageMembers(user?.role)) {
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
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => router.push("/members/new" as never)}
              accessibilityRole="button"
              accessibilityLabel="Cadastrar membro"
            >
              <Plus color={colors.surface} size={18} strokeWidth={2.4} />
              <Text style={styles.headerButtonText}>Novo</Text>
            </TouchableOpacity>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <View style={styles.inviteBox}>
              <View style={styles.inviteHeader}>
                <View style={styles.inviteTitleGroup}>
                  <Text style={styles.inviteTitle}>Link de cadastro de membros</Text>
                  <Text style={styles.inviteText}>
                    {inviteLoading && !invite
                      ? "Carregando convite..."
                      : inviteLink || "Convite indisponivel"}
                  </Text>
                </View>
                {inviteLoading ? <ActivityIndicator color={colors.primary} /> : null}
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
                  <Text style={styles.secondaryButtonText}>Copiar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleRegenerateInvite}
                  disabled={inviteLoading}
                  accessibilityRole="button"
                  accessibilityLabel="Regenerar link de cadastro"
                >
                  <RefreshCw color={colors.primary} size={16} strokeWidth={2.4} />
                  <Text style={styles.secondaryButtonText}>Regenerar</Text>
                </TouchableOpacity>
              </View>
            </View>
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
});
