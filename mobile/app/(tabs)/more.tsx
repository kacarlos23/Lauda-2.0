import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Building2, Guitar, Music2, Settings2, Shield, UserCircle2, Users } from "lucide-react-native";
import { Screen, SectionHeader } from "../../src/components/ui";
import { useAuthStore } from "../../src/store/authStore";
import { colors, radii, spacing, typography } from "../../src/theme";
import { canManageInstrumentCatalog } from "../../src/utils/instrumentCatalog";
import { canManageMusic } from "../../src/utils/musicPermissions";
import { canAccessChurchAdmin, canAccessGlobalAdminArea, canViewMembers, formatRoleLabel } from "../../src/utils/permissions";

type Shortcut = {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
};

export default function MoreScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const canManageArtists = canManageMusic(user, "song:edit") || canManageMusic(user, "song:create");
  const canManageInstruments = canManageInstrumentCatalog(user);
  const canOpenMembers = canViewMembers(user);
  const canOpenChurch = canAccessChurchAdmin(user);
  const canOpenGlobalAdmin = canAccessGlobalAdminArea(user);

  const shortcuts = useMemo<Shortcut[]>(
    () =>
      [
        {
          title: "Perfil",
          description: "Foto, dados pessoais e instrumentos do seu perfil.",
          href: "/profile",
          icon: <UserCircle2 color={colors.primary} size={22} strokeWidth={2.4} />,
        },
        canOpenMembers
          ? {
              title: "Membros",
              description: "Consulte pessoas, convites, permissões e vínculos ministeriais.",
              href: "/members",
              icon: <Users color={colors.primary} size={22} strokeWidth={2.4} />,
            }
          : null,
        canManageArtists
          ? {
              title: "Artistas",
              description: "Edite o catálogo de artistas usado em músicas e cifras.",
              href: "/artists",
              icon: <Music2 color={colors.primary} size={22} strokeWidth={2.4} />,
            }
          : null,
        canManageInstruments
          ? {
              title: "Instrumentos/Cargos",
              description: "Cadastre e ajuste funções usadas em membros e escalas.",
              href: "/instruments?returnTo=/profile",
              icon: <Guitar color={colors.primary} size={22} strokeWidth={2.4} />,
            }
          : null,
        canOpenChurch
          ? {
              title: "Dados da Igreja",
              description: "Acompanhe indicadores do tenant e abra as gestões administrativas.",
              href: "/church",
              icon: <Building2 color={colors.primary} size={22} strokeWidth={2.4} />,
            }
          : null,
        canOpenGlobalAdmin
          ? {
              title: "Painel Global",
              description: "CRUD global, permissões e operação multi-igreja.",
              href: "/global-admin",
              icon: <Shield color={colors.primary} size={22} strokeWidth={2.4} />,
            }
          : null,
      ].filter(Boolean) as Shortcut[],
    [canManageArtists, canManageInstruments, canOpenMembers, canOpenChurch, canOpenGlobalAdmin]
  );

  return (
    <Screen scroll testID="more-screen">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Acesso</Text>
        <Text style={styles.title}>Mais recursos</Text>
        <Text style={styles.subtitle}>Atalhos mobile para telas administrativas e utilitárias.</Text>
        <View style={styles.rolePill}>
          <Settings2 color={colors.primary} size={16} strokeWidth={2.4} />
          <Text style={styles.roleText}>{formatRoleLabel(user?.role)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Atalhos" subtitle="Tudo que existe no desktop e precisa ficar acessível no mobile." />
        <View style={styles.list}>
          {shortcuts.map((shortcut) => (
            <TouchableOpacity
              key={shortcut.href}
              style={styles.card}
              onPress={() => router.push(shortcut.href as never)}
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${shortcut.title}`}
            >
              <View style={styles.iconBox}>{shortcut.icon}</View>
              <View style={styles.copy}>
                <Text style={styles.cardTitle}>{shortcut.title}</Text>
                <Text style={styles.cardDescription}>{shortcut.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.xl },
  eyebrow: { ...typography.eyebrow, color: colors.accentText, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: spacing.xs },
  title: { ...typography.heroTitle, color: colors.ink, marginBottom: spacing.xs },
  subtitle: { ...typography.subtitle, color: colors.text },
  rolePill: {
    marginTop: spacing.md,
    alignSelf: "flex-start",
    minHeight: 38,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  roleText: { ...typography.label, color: colors.primaryDark },
  section: { gap: spacing.md },
  list: { borderTopWidth: 1, borderTopColor: colors.line },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    minHeight: 76,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: "transparent",
    paddingVertical: spacing.md,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, minWidth: 0 },
  cardTitle: { ...typography.cardTitle, color: colors.ink, marginBottom: spacing.xs },
  cardDescription: { ...typography.metadata, color: colors.text },
});
