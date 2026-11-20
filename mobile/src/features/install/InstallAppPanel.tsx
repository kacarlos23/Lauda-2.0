import React from "react";
import { Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Download, Smartphone, X } from "lucide-react-native";
import { Button } from "../../components/ui";
import { uiPatterns } from "../../components/ui/patterns";
import {
  colors,
  controlSizes,
  iconSizes,
  overlays,
  radii,
  shadow,
  spacing,
  typography,
} from "../../theme";
import { useInstallStore } from "./installStore";

type InstallAppPanelProps = {
  variant?: "card" | "compact";
  testIDPrefix?: string;
};

export function InstallAppPanel({
  variant = "card",
  testIDPrefix = "install",
}: InstallAppPanelProps) {
  const {
    supported,
    installed,
    canPrompt,
    channel,
    outcome,
    instructionsVisible,
    apkRelease,
    prompting,
    triggerInstall,
    openInstructions,
    closeInstructions,
  } = useInstallStore();

  if (!supported || installed) {
    return null;
  }

  const handleOpenApk = () => {
    if (!apkRelease) return;
    void Linking.openURL(apkRelease.url).catch(() => undefined);
  };

  const instructionsTitle =
    channel === "ios-safari"
      ? "Adicionar Lauda no iPhone"
      : "Instalar Lauda no navegador";

  const instructionsSteps =
    channel === "ios-safari"
      ? [
          "1. Toque no ícone de Compartilhar na barra do Safari.",
          "2. Escolha Adicionar à Tela de Início.",
          "3. Confirme em Adicionar para abrir o Lauda com ícone próprio.",
        ]
      : [
          "1. Abra o menu do navegador (três pontos no canto superior).",
          "2. Selecione Instalar aplicativo ou Adicionar à tela inicial.",
          "3. Confirme para abrir o Lauda em janela própria.",
        ];

  const modal = (
    <Modal
      visible={instructionsVisible}
      transparent
      animationType="fade"
      onRequestClose={closeInstructions}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard} testID={`${testIDPrefix}-instructions-modal`}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleWrap}>
              <Text style={styles.modalTitle}>{instructionsTitle}</Text>
              <Text style={styles.modalSubtitle}>
                Acesse escalas e cifras rapidamente pela tela inicial do seu aparelho.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={closeInstructions}
              accessibilityRole="button"
              accessibilityLabel="Fechar instruções de instalação"
              testID={`${testIDPrefix}-instructions-close`}
            >
              <X color={colors.primary} size={iconSizes.s18} strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          <View style={styles.stepsList}>
            {instructionsSteps.map((step) => (
              <Text key={step} style={styles.stepText}>
                {step}
              </Text>
            ))}
          </View>

          {apkRelease ? (
            <View style={styles.apkModalBox}>
              <Text style={styles.apkTitle}>
                APK Android assinado · v{apkRelease.version}
              </Text>
              <Text style={styles.apkChecksum} numberOfLines={1}>
                SHA-256: {apkRelease.sha256}
              </Text>
              <Button
                title="Baixar APK para Android"
                variant="secondary"
                size="sm"
                icon={<Download size={iconSizes.s16} strokeWidth={2.2} />}
                onPress={handleOpenApk}
                accessibilityLabel="Baixar APK para Android"
                testID={`${testIDPrefix}-modal-apk-button`}
              />
            </View>
          ) : null}

          <View style={styles.modalFooter}>
            <Button
              title="Entendi"
              onPress={closeInstructions}
              accessibilityLabel="Fechar instruções"
            />
          </View>
        </View>
      </View>
    </Modal>
  );

  if (variant === "compact") {
    return (
      <>
        {modal}
        <View style={styles.compactContainer} testID={`${testIDPrefix}-panel-compact`}>
          <TouchableOpacity
            style={styles.compactAction}
            onPress={() => void triggerInstall()}
            disabled={prompting}
            accessibilityRole="button"
            accessibilityLabel="Instalar Lauda"
            testID={`${testIDPrefix}-install-button`}
          >
            <Smartphone color={colors.primary} size={iconSizes.s16} strokeWidth={2.2} />
            <Text style={styles.compactActionText}>Instalar Lauda</Text>
          </TouchableOpacity>
          {apkRelease ? (
            <TouchableOpacity
              style={styles.compactSecondary}
              onPress={handleOpenApk}
              accessibilityRole="button"
              accessibilityLabel="Baixar APK para Android"
              testID={`${testIDPrefix}-apk-download-button`}
            >
              <Download color={colors.muted} size={iconSizes.s15} strokeWidth={2} />
              <Text style={styles.compactSecondaryText}>
                Baixar APK para Android (v{apkRelease.version})
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </>
    );
  }

  return (
    <>
      {modal}
      <View style={styles.card} testID={`${testIDPrefix}-panel`}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBox}>
            <Smartphone color={colors.primary} size={iconSizes.s20} strokeWidth={2.2} />
          </View>
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>Instalar Lauda</Text>
            <Text style={styles.cardDescription}>
              {canPrompt
                ? "Adicione o aplicativo à tela inicial para abrir em janela própria."
                : "Adicione o atalho do Lauda à tela inicial do seu celular."}
            </Text>
          </View>
        </View>

        {outcome === "dismissed" ? (
          <View style={styles.feedbackRow} testID={`${testIDPrefix}-dismissed-feedback`}>
            <Text style={styles.feedbackText}>
              Instalação cancelada. Tente novamente ou siga o passo a passo manual.
            </Text>
            <TouchableOpacity
              onPress={openInstructions}
              accessibilityRole="button"
              accessibilityLabel="Ver instruções manuais de instalação"
              testID={`${testIDPrefix}-instructions-link`}
            >
              <Text style={styles.instructionsLink}>Ver instruções</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.actionsRow}>
          <Button
            title="Instalar Lauda"
            size="sm"
            loading={prompting}
            icon={<Smartphone size={iconSizes.s16} strokeWidth={2.2} />}
            onPress={() => void triggerInstall()}
            accessibilityLabel="Instalar Lauda"
            testID={`${testIDPrefix}-install-button`}
          />
          {apkRelease ? (
            <Button
              title={`Baixar APK para Android · v${apkRelease.version}`}
              variant="secondary"
              size="sm"
              icon={<Download size={iconSizes.s16} strokeWidth={2.2} />}
              onPress={handleOpenApk}
              accessibilityLabel="Baixar APK para Android"
              testID={`${testIDPrefix}-apk-download-button`}
            />
          ) : null}
        </View>

        {apkRelease ? (
          <Text style={styles.apkChecksum}>SHA-256: {apkRelease.sha256}</Text>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    ...uiPatterns.surface,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  iconBox: {
    width: controlSizes.default,
    height: controlSizes.default,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    ...typography.cardTitle,
    color: colors.ink,
  },
  cardDescription: {
    ...typography.metadata,
    color: colors.muted,
    marginTop: spacing.xxs,
  },
  feedbackRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.warningSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  feedbackText: {
    ...typography.metadata,
    color: colors.warningTextStrong,
    flex: 1,
    minWidth: 180,
  },
  instructionsLink: {
    ...typography.label,
    color: colors.primaryDark,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  apkChecksum: {
    ...typography.metadata,
    color: colors.muted,
  },
  compactContainer: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: spacing.sm,
  },
  compactAction: {
    minHeight: controlSizes.default,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
  },
  compactActionText: {
    ...typography.label,
    color: colors.primaryDark,
  },
  compactSecondary: {
    minHeight: controlSizes.compact,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  compactSecondaryText: {
    ...typography.metadata,
    color: colors.muted,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: overlays.modal,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadow,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  modalTitleWrap: {
    flex: 1,
  },
  modalTitle: {
    ...typography.sectionTitle,
    color: colors.ink,
  },
  modalSubtitle: {
    ...typography.metadata,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  closeButton: {
    width: controlSizes.compact,
    height: controlSizes.compact,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepsList: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  stepText: {
    ...typography.body,
    color: colors.text,
  },
  apkModalBox: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  apkTitle: {
    ...typography.label,
    color: colors.ink,
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
});
