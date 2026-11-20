import React, { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { ArrowLeft, ArrowRight, CheckCircle2, Compass, Guitar, X } from "lucide-react-native";
import { InstrumentBadge } from "../../components/instruments/InstrumentBadge";
import { Button } from "../../components/ui";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { nav } from "../../navigation/routes";
import { useAuthStore } from "../../store/authStore";
import {
  colors,
  controlSizes,
  iconSizes,
  overlays,
  radii,
  shadow,
  spacing,
  typography,
  zIndices,
} from "../../theme";
import { useOnboardingStore } from "./onboardingStore";
import { buildOnboardingSteps, type OnboardingStep } from "./steps";

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function findWebSpotlightRect(step: OnboardingStep | undefined, isMobile: boolean): SpotlightRect | null {
  if (Platform.OS !== "web" || typeof document === "undefined" || typeof window === "undefined") {
    return null;
  }
  if (!step || step.kind !== "navigation") {
    return null;
  }

  let target: Element | null = null;
  if (isMobile && step.navigationItemId) {
    const inner = document.querySelector(`[data-testid="mobile-tab-selection-${step.navigationItemId}"]`);
    target = inner?.closest('[role="tab"]') ?? inner;
  } else if (!isMobile && step.sidebarTestId) {
    target = document.querySelector(`[data-testid="${step.sidebarTestId}"]`);
  }

  if (!target) return null;
  const rect = target.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const fitsViewport =
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.right <= window.innerWidth &&
    rect.bottom <= window.innerHeight;
  if (!fitsViewport) return null;

  return {
    top: Math.round(rect.top),
    left: Math.round(rect.left),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

export function OnboardingOverlay() {
  const user = useAuthStore((state) => state.user);
  const { isMobile, screenWidth } = useResponsiveLayout();
  const pathname = usePathname();
  const router = useRouter();
  const {
    visible,
    stepIndex,
    saving,
    syncForUser,
    nextStep,
    prevStep,
    openProfileInstruments,
    skipTutorial,
    completeTutorial,
  } = useOnboardingStore();
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);

  const steps = useMemo(
    () => buildOnboardingSteps(user, { isMobile }),
    [user, isMobile]
  );

  const safeIndex = Math.min(stepIndex, Math.max(0, steps.length - 1));
  const currentStep = steps[safeIndex];
  const isFinalStep = currentStep?.kind === "instruments";
  const linkedInstruments = user?.instruments ?? [];
  const hasLinkedInstrument = linkedInstruments.length > 0;

  useEffect(() => {
    void syncForUser(user);
  }, [
    user?.id,
    user?.tenantId,
    user?.onboarding?.status,
    user?.onboarding?.shouldAutoStart,
    user?.instruments?.length,
    syncForUser,
  ]);

  useEffect(() => {
    if (!visible || Platform.OS !== "web" || typeof window === "undefined") {
      setSpotlightRect(null);
      return;
    }

    const measure = () => setSpotlightRect(findWebSpotlightRect(currentStep, isMobile));
    const frame = window.requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        void skipTutorial(user);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [visible, currentStep, isMobile, screenWidth, pathname, skipTutorial, user]);

  if (!visible || !user || !currentStep) {
    return null;
  }

  const handleOpenStepTab = () => {
    if (!currentStep.href) return;
    router.push(currentStep.href);
  };

  const handleLinkInstruments = () => {
    openProfileInstruments(user);
    router.push(nav.profileSection("instruments"));
  };

  return (
    <View style={styles.root} pointerEvents="box-none" testID="onboarding-overlay">
      {spotlightRect ? (
        <View
          pointerEvents="none"
          testID="onboarding-spotlight"
          style={[
            styles.spotlight,
            {
              top: spotlightRect.top,
              left: spotlightRect.left,
              width: spotlightRect.width,
              height: spotlightRect.height,
            },
          ]}
        />
      ) : null}

      <View
        style={[
          styles.cardContainer,
          isMobile ? styles.cardContainerMobile : styles.cardContainerDesktop,
        ]}
        pointerEvents="box-none"
      >
        <View
          style={styles.card}
          accessibilityRole="summary"
          accessibilityLabel={`Tutorial passo ${safeIndex + 1} de ${steps.length}: ${currentStep.title}`}
          testID="onboarding-card"
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.badgeIcon}>
                {isFinalStep ? (
                  <Guitar color={colors.primary} size={iconSizes.s16} strokeWidth={2.2} />
                ) : (
                  <Compass color={colors.primary} size={iconSizes.s16} strokeWidth={2.2} />
                )}
              </View>
              <Text style={styles.progressText} testID="onboarding-progress">
                Passo {safeIndex + 1} de {steps.length}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => void skipTutorial(user)}
              accessibilityRole="button"
              accessibilityLabel="Pular tutorial"
              testID="onboarding-close-button"
            >
              <X color={colors.primary} size={iconSizes.s16} strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          <Text style={styles.title} testID="onboarding-step-title">
            {currentStep.title}
          </Text>
          <Text style={styles.description} testID="onboarding-step-description">
            {currentStep.description}
          </Text>

          {!isFinalStep && !spotlightRect && currentStep.href ? (
            <Button
              title={`Abrir ${currentStep.title}`}
              variant="secondary"
              size="sm"
              onPress={handleOpenStepTab}
              accessibilityLabel={`Abrir ${currentStep.title}`}
              testID="onboarding-open-tab-button"
            />
          ) : null}

          {isFinalStep ? (
            <View style={styles.instrumentsSection}>
              {hasLinkedInstrument ? (
                <>
                  <View style={styles.confirmedBanner} testID="onboarding-linked-confirmed">
                    <CheckCircle2 color={colors.success} size={iconSizes.s18} strokeWidth={2.2} />
                    <Text style={styles.confirmedText}>
                      Instrumento ou cargo já vinculado ao seu perfil:
                    </Text>
                  </View>
                  <View style={styles.instrumentBadges}>
                    {linkedInstruments.map((instrument) => (
                      <InstrumentBadge key={instrument.id} instrument={instrument} />
                    ))}
                  </View>
                </>
              ) : null}

              <View style={styles.finalActions}>
                {hasLinkedInstrument ? (
                  <>
                    <Button
                      title="Concluir tutorial"
                      size="sm"
                      loading={saving}
                      onPress={() => void completeTutorial(user)}
                      accessibilityLabel="Concluir tutorial"
                      testID="onboarding-complete-button"
                    />
                    <Button
                      title="Ajustar no perfil"
                      variant="secondary"
                      size="sm"
                      onPress={handleLinkInstruments}
                      accessibilityLabel="Ajustar instrumentos no perfil"
                      testID="onboarding-adjust-profile-button"
                    />
                  </>
                ) : (
                  <Button
                    title="Vincular instrumento ou cargo"
                    size="sm"
                    icon={<Guitar size={iconSizes.s16} strokeWidth={2.2} />}
                    onPress={handleLinkInstruments}
                    accessibilityLabel="Vincular instrumento ou cargo"
                    testID="onboarding-link-instruments-button"
                  />
                )}
              </View>
            </View>
          ) : null}

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => void skipTutorial(user)}
              accessibilityRole="button"
              accessibilityLabel="Pular tutorial"
              testID="onboarding-skip-button"
            >
              <Text style={styles.skipText}>Pular tutorial</Text>
            </TouchableOpacity>

            <View style={styles.navButtons}>
              {safeIndex > 0 ? (
                <Button
                  title="Voltar"
                  variant="secondary"
                  size="sm"
                  icon={<ArrowLeft size={iconSizes.s15} strokeWidth={2.2} />}
                  onPress={() => prevStep(user)}
                  accessibilityLabel="Voltar no tutorial"
                  testID="onboarding-prev-button"
                />
              ) : null}
              {!isFinalStep ? (
                <Button
                  title="Avançar"
                  size="sm"
                  icon={<ArrowRight size={iconSizes.s15} strokeWidth={2.2} />}
                  onPress={() => nextStep(steps.length, user)}
                  accessibilityLabel="Avançar no tutorial"
                  testID="onboarding-next-button"
                />
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: zIndices.toast,
  },
  spotlight: {
    position: "absolute",
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: overlays.mobileTabSelection,
  },
  cardContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  cardContainerMobile: {
    justifyContent: "flex-end",
    paddingBottom: controlSizes.tabBar + spacing.lg,
  },
  cardContainerDesktop: {
    justifyContent: "flex-end",
    alignItems: "flex-end",
    paddingBottom: spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  badgeIcon: {
    width: controlSizes.compact,
    height: controlSizes.compact,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  progressText: {
    ...typography.eyebrow,
    color: colors.primaryDark,
    textTransform: "uppercase",
  },
  closeButton: {
    width: controlSizes.compact,
    height: controlSizes.compact,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...typography.sectionTitle,
    color: colors.ink,
  },
  description: {
    ...typography.body,
    color: colors.text,
  },
  instrumentsSection: {
    gap: spacing.sm,
  },
  confirmedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.successSoft,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  confirmedText: {
    ...typography.label,
    color: colors.success,
    flex: 1,
  },
  instrumentBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  finalActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  skipButton: {
    minHeight: controlSizes.compact,
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  skipText: {
    ...typography.label,
    color: colors.muted,
  },
  navButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});
