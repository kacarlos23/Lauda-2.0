import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Building2,
  CalendarClock,
  Guitar,
  Pencil,
  RefreshCcw,
  Save,
  ShieldAlert,
  UsersRound,
  Workflow,
} from "lucide-react-native";
import { Button, ErrorBanner, LoadingState, RichCommentEditor, RichCommentView } from "../../../src/components/ui";
import { useAuthStore } from "../../../src/store/authStore";
import { useChurchStore } from "../../../src/store/churchStore";
import { colors, radii, screen, spacing } from "../../../src/theme";
import { canAccessChurchAdmin } from "../../../src/utils/permissions";

function formatDate(value?: string): string {
  if (!value) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(value)
  );
}

export default function ChurchAdminScreen() {
  const { user } = useAuthStore();
  const { summary, loading, saving, error, loadChurch, updateChurch } = useChurchStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [comments, setComments] = useState("");

  const canAccess = canAccessChurchAdmin(user);
  const trimmedName = name.trim();
  const hasChanges = trimmedName !== summary?.tenant.name || comments !== (summary?.tenant.comments ?? "");
  const canSave = trimmedName.length > 0 && hasChanges && !saving;

  const sections = useMemo(
    () => [
      { label: "Membros", description: "Gerencie pessoas e permissões", href: "/members" },
      { label: "Ministérios", description: "Organize equipes e responsáveis", href: "/ministries" },
      { label: "Escalas", description: "Acompanhe agenda e participantes", href: "/schedules" },
      { label: "Instrumentos/Cargos", description: "Configure funções do tenant", href: "/instruments?returnTo=/church" },
    ],
    []
  );

  useEffect(() => {
    if (canAccess) {
      void loadChurch();
    }
  }, [canAccess, loadChurch]);

  useEffect(() => {
    setName(summary?.tenant.name ?? "");
    setComments(summary?.tenant.comments ?? "");
  }, [summary?.tenant.name, summary?.tenant.comments]);

  async function handleSave() {
    if (!canSave) return;
    try {
      await updateChurch({ name: trimmedName, comments: comments || null });
      setEditing(false);
    } catch {
      setName(summary?.tenant.name ?? name);
    }
  }

  if (!canAccess) {
    return (
      <SafeAreaView style={styles.safe} edges={["left", "right"]}>
        <View style={styles.denied}>
          <ShieldAlert color={colors.danger} size={30} strokeWidth={2.4} />
          <Text style={styles.deniedTitle}>Acesso negado</Text>
          <Text style={styles.deniedText}>Esta área é exclusiva para líderes da igreja.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Dados da Igreja</Text>
          <Text style={styles.subtitle}>Administração do tenant atual</Text>
        </View>

        {loading && !summary ? (
          <LoadingState centered={false} message="Carregando dados da igreja..." style={styles.stateBox} />
        ) : error && !summary ? (
          <View style={styles.stateBox}>
            <ErrorBanner
              message={error}
              action={
                <Button
                  title="Tentar novamente"
                  icon={<RefreshCcw color={colors.primary} size={16} strokeWidth={2.5} />}
                  variant="secondary"
                  size="sm"
                  onPress={loadChurch}
                  accessibilityLabel="Tentar carregar dados da igreja novamente"
                />
              }
            />
          </View>
        ) : summary ? (
          <>
            <View style={styles.churchCard}>
              <View style={styles.cardHeader}>
                <View style={styles.iconBox}>
                  <Building2 color={colors.primary} size={22} strokeWidth={2.5} />
                </View>
                <View style={styles.cardTitleBox}>
                  <Text style={styles.cardEyebrow}>Igreja</Text>
                  {editing ? (
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      style={styles.input}
                      autoCapitalize="words"
                      accessibilityLabel="Nome da igreja"
                    />
                  ) : (
                    <Text style={styles.churchName}>{summary.tenant.name}</Text>
                  )}
                  <Text style={styles.createdText}>Criada em {formatDate(summary.tenant.createdAt)}</Text>
                </View>
              </View>

              {editing ? <RichCommentEditor value={comments} onChange={setComments} label="Comentários" placeholder="Informações e orientações gerais da igreja..." testID="church-comments-input" /> : summary.tenant.comments ? <View style={styles.commentsCard}><Text style={styles.commentsTitle}>Comentários</Text><RichCommentView value={summary.tenant.comments} /></View> : null}

              {editing ? (
                <View style={styles.editActions}>
                  <TouchableOpacity
                    style={[styles.primaryButton, !canSave && styles.disabledButton]}
                    onPress={handleSave}
                    disabled={!canSave}
                    accessibilityRole="button"
                  >
                    {saving ? (
                      <ActivityIndicator color={colors.surface} />
                    ) : (
                      <Save color={colors.surface} size={16} strokeWidth={2.5} />
                    )}
                    <Text style={styles.primaryButtonText}>Salvar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => {
                      setName(summary.tenant.name);
                      setComments(summary.tenant.comments ?? "");
                      setEditing(false);
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={styles.secondaryButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.actionButton} onPress={() => setEditing(true)} accessibilityRole="button">
                  <Pencil color={colors.primary} size={16} strokeWidth={2.5} />
                  <Text style={styles.actionButtonText}>Editar</Text>
                </TouchableOpacity>
              )}
            </View>

            <ErrorBanner message={error} style={styles.inlineError} />

            <View style={styles.summaryRow}>
              <Metric icon={UsersRound} label="Membros" value={summary._count.users} />
              <Metric icon={Workflow} label="Ministérios" value={summary._count.ministries} />
            </View>
            <View style={styles.summaryRow}>
              <Metric icon={CalendarClock} label="Escalas" value={summary._count.schedules} />
              <Metric icon={Guitar} label="Instrumentos" value={summary._count.instruments} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Gestão</Text>
              <View style={styles.list}>
                {sections.map((section) => (
                  <View key={section.href} style={styles.manageRow}>
                    <View style={styles.manageCopy}>
                      <Text style={styles.manageTitle}>{section.label}</Text>
                      <Text style={styles.manageDescription}>{section.description}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => router.push(section.href as never)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.actionButtonText}>Gerenciar</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UsersRound;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.metric} accessible accessibilityLabel={`${label}: ${value}`}>
      <Icon color={colors.primaryDark} size={22} strokeWidth={2.4} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    width: "100%",
    maxWidth: screen.listMaxWidth,
    alignSelf: "center",
    padding: spacing.xl,
    paddingBottom: screen.contentBottomPadding,
  },
  header: { marginBottom: spacing.xl },
  title: { fontSize: 30, fontWeight: "900", color: colors.ink, marginBottom: spacing.sm },
  subtitle: { fontSize: 15, color: colors.muted, fontWeight: "700" },
  churchCard: {
    backgroundColor: "transparent",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitleBox: { flex: 1 },
  cardEyebrow: { color: colors.muted, fontSize: 12, fontWeight: "800", marginBottom: spacing.xs },
  churchName: { color: colors.ink, fontSize: 20, fontWeight: "900", marginBottom: spacing.xs },
  createdText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  commentsCard: { paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.line },
  commentsTitle: { color: colors.ink, fontSize: 14, fontWeight: "800", marginBottom: spacing.sm },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
    backgroundColor: colors.surface,
    marginBottom: spacing.xs,
  },
  summaryRow: { flexDirection: "row", gap: 0, marginBottom: spacing.sm },
  metric: {
    flex: 1,
    minHeight: 104,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.line,
  },
  metricValue: { fontSize: 26, fontWeight: "900", color: colors.primaryDark, marginTop: spacing.sm },
  metricLabel: { color: colors.text, fontSize: 12, fontWeight: "800", marginTop: spacing.xs },
  section: { marginTop: spacing.sm },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", marginBottom: spacing.md },
  list: { borderTopWidth: 1, borderTopColor: colors.line },
  manageRow: {
    minHeight: 76,
    backgroundColor: "transparent",
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  manageCopy: { flex: 1 },
  manageTitle: { color: colors.ink, fontSize: 15, fontWeight: "900", marginBottom: spacing.xs },
  manageDescription: { color: colors.muted, fontSize: 12, fontWeight: "700", lineHeight: 18 },
  actionButton: {
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  actionButtonText: { color: colors.primary, fontSize: 13, fontWeight: "900" },
  editActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  primaryButton: {
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  primaryButtonText: { color: colors.surface, fontSize: 14, fontWeight: "900" },
  secondaryButton: {
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: "900" },
  disabledButton: { opacity: 0.55 },
  stateBox: {
    backgroundColor: "transparent",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.xl,
    gap: spacing.md,
    alignItems: "flex-start",
  },
  inlineError: { marginBottom: spacing.lg },
  denied: {
    flex: 1,
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  deniedTitle: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  deniedText: { color: colors.muted, fontSize: 15, fontWeight: "700", textAlign: "center" },
});
