import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Settings2 } from "lucide-react-native";
import { Screen, SectionHeader } from "../../src/components/ui";
import { useAuthStore } from "../../src/store/authStore";
import { colors, controlSizes, iconSizes, radii, spacing, typography } from "../../src/theme";
import { formatRoleLabel } from "../../src/utils/permissions";
import { hrefForNavigationItem, navigationItemsFor } from "../../src/navigation/manifest";

export default function MoreScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const shortcuts = useMemo(() => navigationItemsFor("mobile-more", user), [user]);

  return (
    <Screen scroll testID="more-screen">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Acesso</Text>
        <Text style={styles.title}>Mais recursos</Text>
        <Text style={styles.subtitle}>Atalhos mobile para telas administrativas e utilitárias.</Text>
        <View style={styles.rolePill}>
          <Settings2 color={colors.primary} size={iconSizes.s16} strokeWidth={2.4} />
          <Text style={styles.roleText}>{formatRoleLabel(user?.role)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Atalhos" subtitle="Tudo que existe no desktop e precisa ficar acessível no mobile." />
        <View style={styles.list}>
          {shortcuts.map((shortcut) => (
            <TouchableOpacity
              key={shortcut.id}
              style={styles.card}
              onPress={() => router.push(hrefForNavigationItem(shortcut))}
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${shortcut.label}`}
            >
              <View style={styles.iconBox}>
                <shortcut.Icon color={colors.primary} size={iconSizes.s22} strokeWidth={2.4} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.cardTitle}>{shortcut.label}</Text>
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
    width: controlSizes.default,
    height: controlSizes.default,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, minWidth: 0 },
  cardTitle: { ...typography.cardTitle, color: colors.ink, marginBottom: spacing.xs },
  cardDescription: { ...typography.metadata, color: colors.text },
});
