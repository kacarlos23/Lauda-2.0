import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, overlays, radii, shadow, spacing, typography } from "../../theme";
import { Button } from "./Button";

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Fechar confirmação" />
        <View style={styles.dialog} accessibilityViewIsModal>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Button title={cancelLabel} variant="secondary" onPress={onCancel} disabled={loading} />
            <Button
              title={confirmLabel}
              variant={danger ? "danger" : "primary"}
              onPress={onConfirm}
              loading={loading}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: overlays.modalBrand,
  },
  dialog: {
    width: "100%",
    maxWidth: 480,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    ...shadow,
  },
  title: { ...typography.sectionTitle, color: colors.ink },
  message: { ...typography.body, color: colors.muted, marginTop: spacing.sm },
  actions: {
    marginTop: spacing.xl,
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
