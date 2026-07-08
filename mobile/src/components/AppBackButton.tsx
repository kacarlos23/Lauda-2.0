import { useCallback } from "react";
import { BackHandler, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { goBackTo } from "../utils/navigation";
import { colors, radii, spacing } from "../theme";

type Props = {
  href: string;
  label?: string;
  compact?: boolean;
};

export function AppBackButton({ href, label = "Voltar", compact = false }: Props) {
  const router = useRouter();
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      goBackTo(router, href);
      return true;
    });
    return () => subscription.remove();
  }, [href, router]));

  return (
    <TouchableOpacity
      style={[styles.button, compact && styles.compact]}
      onPress={() => goBackTo(router, href)}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={compact ? "app-back-button-compact" : "app-back-button"}
    >
      <ArrowLeft color={colors.primary} size={compact ? 23 : 18} strokeWidth={2.4} />
      {!compact ? <Text style={styles.label}>{label}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { alignSelf: "flex-start", minHeight: 40, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.primarySoft, borderRadius: radii.md, paddingHorizontal: spacing.md },
  compact: { width: 42, paddingHorizontal: 0, justifyContent: "center" },
  label: { color: colors.primary, fontSize: 15, fontWeight: "800" },
});
