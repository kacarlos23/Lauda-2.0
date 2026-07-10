import React from "react";
import { Modal, ScrollView, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { SlidersHorizontal, X } from "lucide-react-native";
import { colors, radii, shadow, spacing, typography } from "../../theme";
import { Button } from "./Button";

type FilterPanelProps = {
  visible: boolean;
  title?: string;
  canApply: boolean;
  onApply: () => void;
  onClose: () => void;
  onClear?: () => void;
  children: React.ReactNode;
};

type FilterButtonProps = {
  active?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function FilterButton({ active = false, onPress, style, accessibilityLabel = "Abrir filtros" }: FilterButtonProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[styles.filterButton, active && styles.filterButtonActive, style]}
    >
      <SlidersHorizontal color={active ? colors.surface : colors.primary} size={20} strokeWidth={2.4} />
    </TouchableOpacity>
  );
}

export function FilterPanel({ visible, title = "Filtros", canApply, onApply, onClose, onClear, children }: FilterPanelProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fechar filtros" style={styles.closeButton} onPress={onClose}>
              <X color={colors.muted} size={22} strokeWidth={2.3} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          <View style={styles.footer}>
            {onClear ? (
              <Button title="Limpar" variant="ghost" onPress={onClear} accessibilityLabel="Limpar filtros" />
            ) : null}
            <Button title="Cancelar" variant="secondary" onPress={onClose} accessibilityLabel="Cancelar filtros" />
            <Button title="Buscar" onPress={onApply} disabled={!canApply} accessibilityLabel="Aplicar filtros" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.options}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(16,32,26,0.28)",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  panel: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "88%",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow,
  },
  header: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  title: { ...typography.cardTitle, color: colors.ink },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.label, color: colors.text },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
