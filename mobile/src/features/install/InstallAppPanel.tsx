import React, { useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  X,
} from "lucide-react-native";
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
import { formatApkSize } from "./apkRelease";
import { useInstallStore } from "./installStore";

type InstallAppPanelProps = {
  variant?: "card" | "compact";
  testIDPrefix?: string;
  showVersionWhenUpToDate?: boolean;
};

export function InstallAppPanel({
  variant = "card",
  testIDPrefix = "install",
  showVersionWhenUpToDate = variant === "card",
}: InstallAppPanelProps) {
  const {
    supported,
    installed,
    deviceClass,
    isNativeApp,
    installedVersion,
    installedVersionCode,
    instructionsVisible,
    apkGuideVisible,
    apkRelease,
    updateAvailable,
    checkingUpdate,
    updateCheckStatus,
    prompting,
    triggerInstall,
    downloadApk,
    checkForUpdates,
    openApkGuide,
    closeInstructions,
    closeApkGuide,
  } = useInstallStore();

  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // Mode B: Native iOS has no APK sideload/update UI.
  if (isNativeApp && deviceClass === "ios") {
    return null;
  }

  // Mode A: Native Android APK — login hides panel; More/Profile checks updates.
  if (isNativeApp && deviceClass === "android") {
    if (variant === "compact") {
      return null;
    }

    const apkSize = formatApkSize(apkRelease?.fileSizeBytes);

    const updateGuideModal = apkRelease ? (
      <Modal
        visible={apkGuideVisible}
        transparent
        animationType="fade"
        onRequestClose={closeApkGuide}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} testID={`${testIDPrefix}-apk-guide-modal`}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <Text style={styles.modalTitle}>Como atualizar o Lauda</Text>
                <Text style={styles.modalSubtitle}>
                  Atualize mantendo sua conta e seus dados conectados neste aparelho.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={closeApkGuide}
                accessibilityRole="button"
                accessibilityLabel="Fechar instruções de atualização"
                testID={`${testIDPrefix}-apk-guide-close`}
              >
                <X color={colors.primary} size={iconSizes.s18} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            <View style={styles.stepsList}>
              <Text style={styles.stepText}>
                1. Aguarde o download do arquivo .apk concluir na barra de notificações.
              </Text>
              <Text style={styles.stepText}>
                2. Toque no arquivo baixado (ou abra a pasta Downloads do aparelho).
              </Text>
              <Text style={styles.stepText}>
                3. Confirme em Atualizar. Sua conta e seus dados permanecem salvos.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.checksumToggle}
              onPress={() => setShowTechnicalDetails((current) => !current)}
              accessibilityRole="button"
              accessibilityLabel="Detalhes de segurança SHA-256"
              testID={`${testIDPrefix}-apk-checksum-toggle`}
            >
              <ShieldCheck color={colors.muted} size={iconSizes.s15} strokeWidth={2} />
              <Text style={styles.checksumToggleText}>Detalhes de segurança (SHA-256)</Text>
              {showTechnicalDetails ? (
                <ChevronUp color={colors.muted} size={iconSizes.s15} strokeWidth={2} />
              ) : (
                <ChevronDown color={colors.muted} size={iconSizes.s15} strokeWidth={2} />
              )}
            </TouchableOpacity>

            {showTechnicalDetails ? (
              <View style={styles.checksumDetails} testID={`${testIDPrefix}-apk-checksum-details`}>
                <Text style={styles.apkChecksum}>
                  Versão: v{apkRelease.version}
                  {apkRelease.versionCode ? ` (build ${apkRelease.versionCode})` : ""}
                </Text>
                <Text style={styles.apkChecksum}>SHA-256: {apkRelease.sha256}</Text>
              </View>
            ) : null}

            <View style={styles.modalFooterActions}>
              <Button
                title="Baixar novamente"
                variant="secondary"
                size="sm"
                onPress={() => void downloadApk()}
                testID={`${testIDPrefix}-apk-redownload-button`}
              />
              <Button
                title="Entendi"
                size="sm"
                onPress={closeApkGuide}
                accessibilityLabel="Fechar instruções"
              />
            </View>
          </View>
        </View>
      </Modal>
    ) : null;

    if (updateAvailable && apkRelease) {
      return (
        <>
          {updateGuideModal}
          <View style={styles.cardUpdate} testID={`${testIDPrefix}-apk-update-card`}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBoxAccent}>
                <Download color={colors.accentText} size={iconSizes.s20} strokeWidth={2.2} />
              </View>
              <View style={styles.cardCopy}>
                <Text style={styles.cardTitle}>
                  Atualização disponível · v{apkRelease.version}
                </Text>
                <Text style={styles.cardDescription}>
                  {apkRelease.releaseNotes ??
                    "Uma nova versão do Lauda está pronta para instalar por cima da versão atual, mantendo sua conta conectada."}
                </Text>
              </View>
            </View>

            <Text style={styles.apkMeta}>
              Versão instalada: v{installedVersion ?? "-"}
              {apkSize ? ` · Tamanho: ${apkSize}` : ""}
            </Text>

            <View style={styles.actionsRow}>
              <Button
                title="Atualizar aplicativo"
                size="sm"
                icon={<Download size={iconSizes.s16} strokeWidth={2.2} />}
                onPress={() => void downloadApk()}
                accessibilityLabel="Atualizar aplicativo"
                testID={`${testIDPrefix}-apk-update-button`}
              />
              <Button
                title="Como atualizar"
                variant="secondary"
                size="sm"
                onPress={openApkGuide}
                accessibilityLabel="Como atualizar o aplicativo"
                testID={`${testIDPrefix}-apk-guide-button`}
              />
            </View>
          </View>
        </>
      );
    }

    if (!showVersionWhenUpToDate) {
      return null;
    }

    return (
      <View style={styles.card} testID={`${testIDPrefix}-apk-version-card`}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBox}>
            <Smartphone color={colors.primary} size={iconSizes.s20} strokeWidth={2.2} />
          </View>
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>
              Aplicativo Android · Lauda v{installedVersion ?? "1.0.0"}
            </Text>
            <Text style={styles.cardDescription}>
              {installedVersionCode
                ? `Build ${installedVersionCode} instalado neste aparelho.`
                : "Versão instalada neste aparelho."}
            </Text>
          </View>
        </View>

        {updateCheckStatus === "up-to-date" ? (
          <Text style={styles.statusOkText} testID={`${testIDPrefix}-apk-uptodate-text`}>
            Você já está na versão mais recente.
          </Text>
        ) : null}

        {updateCheckStatus === "error" ? (
          <Text style={styles.statusErrorText} testID={`${testIDPrefix}-apk-check-error-text`}>
            Não foi possível verificar agora. Tente novamente com conexão ativa.
          </Text>
        ) : null}

        <View style={styles.actionsRow}>
          <Button
            title="Verificar atualizações"
            variant="secondary"
            size="sm"
            loading={checkingUpdate}
            icon={<RefreshCw size={iconSizes.s15} strokeWidth={2.2} />}
            onPress={() => void checkForUpdates({ force: true })}
            accessibilityLabel="Verificar atualizações do aplicativo"
            testID={`${testIDPrefix}-check-updates-button`}
          />
        </View>
      </View>
    );
  }

  // Web environment checks
  if (!supported) {
    return null;
  }

  // Mode C: iOS Web (Safari / Tela de Início only — never show APK download)
  if (deviceClass === "ios") {
    if (installed) {
      return null;
    }

    const iosModal = (
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
                <Text style={styles.modalTitle}>Adicionar Lauda no iPhone</Text>
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
              <Text style={styles.stepText}>
                1. Toque no ícone de Compartilhar na barra do Safari.
              </Text>
              <Text style={styles.stepText}>
                2. Escolha Adicionar à Tela de Início.
              </Text>
              <Text style={styles.stepText}>
                3. Confirme em Adicionar para abrir o Lauda com ícone próprio.
              </Text>
            </View>

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
          {iosModal}
          <View style={styles.compactContainer} testID={`${testIDPrefix}-panel-compact`}>
            <TouchableOpacity
              style={styles.compactAction}
              onPress={() => void triggerInstall()}
              disabled={prompting}
              accessibilityRole="button"
              accessibilityLabel="Instalar no iPhone"
              testID={`${testIDPrefix}-install-button`}
            >
              <Smartphone color={colors.primary} size={iconSizes.s16} strokeWidth={2.2} />
              <Text style={styles.compactActionText}>Instalar no iPhone</Text>
            </TouchableOpacity>
          </View>
        </>
      );
    }

    return (
      <>
        {iosModal}
        <View style={styles.card} testID={`${testIDPrefix}-panel`}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <Smartphone color={colors.primary} size={iconSizes.s20} strokeWidth={2.2} />
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>Instalar no iPhone</Text>
              <Text style={styles.cardDescription}>
                Adicione o atalho do Lauda à tela inicial pelo Safari para abrir em janela própria.
              </Text>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <Button
              title="Instalar no iPhone"
              size="sm"
              loading={prompting}
              icon={<Smartphone size={iconSizes.s16} strokeWidth={2.2} />}
              onPress={() => void triggerInstall()}
              accessibilityLabel="Instalar no iPhone"
              testID={`${testIDPrefix}-install-button`}
            />
          </View>
        </View>
      </>
    );
  }

  // Mode D: Android Web (including Android PWA standalone) and Desktop Web — APK first
  if (!apkRelease) {
    return null;
  }

  const apkSize = formatApkSize(apkRelease.fileSizeBytes);
  const versionMeta = apkSize
    ? `v${apkRelease.version} · ${apkSize}`
    : `v${apkRelease.version}`;

  const apkGuideModal = (
    <Modal
      visible={apkGuideVisible}
      transparent
      animationType="fade"
      onRequestClose={closeApkGuide}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard} testID={`${testIDPrefix}-apk-guide-modal`}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleWrap}>
              <Text style={styles.modalTitle}>Como instalar o Lauda no Android</Text>
              <Text style={styles.modalSubtitle}>
                Siga os passos abaixo após concluir o download do instalador.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={closeApkGuide}
              accessibilityRole="button"
              accessibilityLabel="Fechar instruções de instalação Android"
              testID={`${testIDPrefix}-apk-guide-close`}
            >
              <X color={colors.primary} size={iconSizes.s18} strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          <View style={styles.stepsList}>
            <Text style={styles.stepText}>
              1. Aguarde o download do arquivo .apk concluir na barra de notificações.
            </Text>
            <Text style={styles.stepText}>
              2. Toque no arquivo baixado (ou abra a pasta Downloads do aparelho).
            </Text>
            <Text style={styles.stepText}>
              3. Se o Android pedir permissão, toque em Configurações, ative Permitir desta fonte e confirme em Instalar.
            </Text>
          </View>

          {deviceClass === "desktop" ? (
            <Text style={styles.desktopNote} testID={`${testIDPrefix}-apk-desktop-note`}>
              Se você baixou pelo computador, transfira o arquivo .apk para o seu celular Android e abra-o por lá.
            </Text>
          ) : null}

          <TouchableOpacity
            style={styles.checksumToggle}
            onPress={() => setShowTechnicalDetails((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel="Detalhes de segurança SHA-256"
            testID={`${testIDPrefix}-apk-checksum-toggle`}
          >
            <ShieldCheck color={colors.muted} size={iconSizes.s15} strokeWidth={2} />
            <Text style={styles.checksumToggleText}>Detalhes de segurança (SHA-256)</Text>
            {showTechnicalDetails ? (
              <ChevronUp color={colors.muted} size={iconSizes.s15} strokeWidth={2} />
            ) : (
              <ChevronDown color={colors.muted} size={iconSizes.s15} strokeWidth={2} />
            )}
          </TouchableOpacity>

          {showTechnicalDetails ? (
            <View style={styles.checksumDetails} testID={`${testIDPrefix}-apk-checksum-details`}>
              <Text style={styles.apkChecksum}>
                Versão: v{apkRelease.version}
                {apkRelease.versionCode ? ` (build ${apkRelease.versionCode})` : ""}
              </Text>
              <Text style={styles.apkChecksum}>SHA-256: {apkRelease.sha256}</Text>
            </View>
          ) : null}

          <View style={styles.modalFooterActions}>
            <Button
              title="Baixar novamente"
              variant="secondary"
              size="sm"
              onPress={() => void downloadApk()}
              testID={`${testIDPrefix}-apk-redownload-button`}
            />
            <Button
              title="Entendi"
              size="sm"
              onPress={closeApkGuide}
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
        {apkGuideModal}
        <View style={styles.compactContainer} testID={`${testIDPrefix}-panel-compact`}>
          <TouchableOpacity
            style={styles.compactAction}
            onPress={() => void downloadApk()}
            accessibilityRole="button"
            accessibilityLabel={
              deviceClass === "android"
                ? "Baixar app Android (APK)"
                : "Baixar APK para Android"
            }
            testID={`${testIDPrefix}-apk-download-button`}
          >
            <Download color={colors.primaryDark} size={iconSizes.s16} strokeWidth={2.2} />
            <Text style={styles.compactActionText}>
              {deviceClass === "android"
                ? "Baixar app Android (APK)"
                : "Baixar APK para Android"}
            </Text>
          </TouchableOpacity>
          <Text style={styles.compactMeta}>
            {deviceClass === "desktop"
              ? `Instalador para celulares Android · ${versionMeta}`
              : `Versão ${versionMeta} · Android`}
          </Text>
          <TouchableOpacity
            style={styles.compactSecondary}
            onPress={openApkGuide}
            accessibilityRole="button"
            accessibilityLabel="Como instalar no Android"
            testID={`${testIDPrefix}-apk-guide-button`}
          >
            <Text style={styles.compactSecondaryText}>Como instalar no Android</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      {apkGuideModal}
      <View style={styles.card} testID={`${testIDPrefix}-panel`}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBox}>
            <Smartphone color={colors.primary} size={iconSizes.s20} strokeWidth={2.2} />
          </View>
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>
              {deviceClass === "android" ? "Baixar app Android (APK)" : "App Android (APK)"}
            </Text>
            <Text style={styles.cardDescription}>
              {deviceClass === "android"
                ? "Instale o aplicativo oficial do Lauda diretamente no seu celular Android."
                : `Baixe o instalador APK (${versionMeta}) para instalar em um celular Android.`}
            </Text>
          </View>
        </View>

        {apkRelease.releaseNotes ? (
          <Text style={styles.releaseNotes}>{apkRelease.releaseNotes}</Text>
        ) : null}

        <Text style={styles.apkMeta}>Versão {versionMeta}</Text>

        <View style={styles.actionsRow}>
          <Button
            title={`Baixar APK · v${apkRelease.version}`}
            size="sm"
            icon={<Download size={iconSizes.s16} strokeWidth={2.2} />}
            onPress={() => void downloadApk()}
            accessibilityLabel="Baixar APK para Android"
            testID={`${testIDPrefix}-apk-download-button`}
          />
          <Button
            title="Como instalar"
            variant="secondary"
            size="sm"
            onPress={openApkGuide}
            accessibilityLabel="Como instalar no Android"
            testID={`${testIDPrefix}-apk-guide-button`}
          />
        </View>
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
  cardUpdate: {
    ...uiPatterns.surface,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
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
  iconBoxAccent: {
    width: controlSizes.default,
    height: controlSizes.default,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
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
  releaseNotes: {
    ...typography.body,
    color: colors.text,
  },
  apkMeta: {
    ...typography.metadata,
    color: colors.muted,
  },
  statusOkText: {
    ...typography.metadata,
    color: colors.success,
  },
  statusErrorText: {
    ...typography.metadata,
    color: colors.danger,
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
    gap: spacing.xs,
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
  compactMeta: {
    ...typography.metadata,
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.xxs,
  },
  compactSecondary: {
    minHeight: controlSizes.compact,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  compactSecondaryText: {
    ...typography.label,
    color: colors.primary,
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
  desktopNote: {
    ...typography.metadata,
    color: colors.text,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  checksumToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  checksumToggleText: {
    ...typography.metadata,
    color: colors.muted,
    flex: 1,
  },
  checksumDetails: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  modalFooterActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
