import { uiPatterns } from "./ui/patterns";
import { useEffect } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Monitor, Moon, Sun } from "lucide-react-native";
import { colors, controlSizes, iconSizes, radii, spacing, typography } from "../theme";
import { useThemeStore } from "../store/themeStore";
import { ThemePreference, themePreviewEnabled } from "../tokens/colorModes";

const enabled = themePreviewEnabled && Platform.OS === "web";

export function ThemeRuntime() {
  const initialize = useThemeStore((state) => state.initialize);
  useEffect(() => { if (enabled) return initialize(); }, [initialize]);
  return null;
}

export function ThemeToggle() {
  const mode = useThemeStore((state) => state.mode);
  const setPreference = useThemeStore((state) => state.setPreference);
  if (!enabled) return null;
  const Icon = mode === "dark" ? Sun : Moon;
  return <TouchableOpacity
    accessibilityRole="button" accessibilityLabel={mode === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
    onPress={() => setPreference(mode === "dark" ? "light" : "dark")} style={styles.toggle} testID="theme-toggle"
  ><Icon color={colors.primary} size={iconSizes.s20} /></TouchableOpacity>;
}

export function AppearancePreferences() {
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  if (!enabled) return null;
  const choices = [["light", "Claro", Sun], ["dark", "Escuro", Moon], ["system", "Sistema", Monitor]] as const;
  return <View style={styles.section} testID="appearance-preferences">
    <Text style={styles.title}>Aparência</Text>
    <Text style={styles.help}>Escolha o tema neste dispositivo ou acompanhe a preferência do sistema.</Text>
    <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Tema da interface">{choices.map(([value, label, Icon]) => <TouchableOpacity
      key={value} accessibilityRole="radio" accessibilityLabel={`Tema ${label.toLowerCase()}`}
      accessibilityState={{ checked: preference === value }} testID={`theme-option-${value}`}
      aria-checked={preference === value}
      style={[styles.option, preference === value && styles.selected]} onPress={() => setPreference(value as ThemePreference)}
    ><Icon color={colors.primary} size={iconSizes.s20} /><Text style={styles.label}>{label}</Text></TouchableOpacity>)}</View>
  </View>;
}

const styles = StyleSheet.create({
  toggle: { width: controlSizes.default, height: controlSizes.default, alignItems: "center", justifyContent: "center", borderRadius: radii.md },
  section: { ...uiPatterns.section, marginBottom: spacing.xl, paddingBottom: spacing.xl },
  title: { ...typography.sectionTitle, color: colors.ink },
  help: { ...typography.body, color: colors.muted, marginTop: spacing.sm, marginBottom: spacing.lg },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  option: { minHeight: controlSizes.default, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md },
  selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  label: { ...typography.button, color: colors.text },
});
