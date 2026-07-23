import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { colors, screen, spacing, typography } from "../theme";
import { BrandLogo } from "./BrandLogo";

type AuthShellProps = {
  overline: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  width?: "compact" | "wide";
};

export function AuthShell({
  overline,
  title,
  subtitle,
  children,
  width = "compact",
}: AuthShellProps) {
  const { width: viewportWidth, height } = useWindowDimensions();
  const [hydrated, setHydrated] = useState(Platform.OS !== "web");
  const desktop = hydrated && viewportWidth >= 900;

  useEffect(() => {
    setHydrated(true);
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.shell,
          hydrated ? { minHeight: height } : undefined,
          desktop && styles.shellDesktop,
        ]}
      >
        {desktop ? (
          <View style={styles.brandPanel}>
            <BrandLogo tone="light" width={164} />
            <View style={styles.brandCopy}>
              <Text style={styles.brandOverline}>Gestão ministerial</Text>
              <Text style={styles.brandTitle}>Organize o ministério.{"\n"}Cuide das pessoas.</Text>
              <Text style={styles.brandDescription}>
                Escalas, repertório, equipes e acompanhamento em uma experiência simples e intencional.
              </Text>
            </View>
            <View>
              <View style={styles.accentLine} />
              <Text style={styles.brandFootnote}>Feito para servir quem serve.</Text>
            </View>
          </View>
        ) : null}

        <View style={[styles.formPanel, desktop && styles.formPanelDesktop]}>
          <View
            style={[
              styles.formContent,
              { maxWidth: width === "wide" ? screen.formMaxWidth : 520 },
            ]}
          >
            {!desktop ? <BrandLogo width={142} style={styles.mobileLogo} /> : null}
            <Text style={styles.overline}>{overline}</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
            <View style={styles.content}>{children}</View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  shell: {
    flexGrow: 1,
    backgroundColor: colors.background,
  },
  shellDesktop: {
    flexDirection: "row",
  },
  brandPanel: {
    width: "36%",
    minWidth: 360,
    maxWidth: 520,
    justifyContent: "space-between",
    backgroundColor: colors.surfaceDark,
    paddingHorizontal: spacing.xxl,
    paddingTop: 48,
    paddingBottom: spacing.xxl,
  },
  brandCopy: {
    maxWidth: 360,
  },
  brandOverline: {
    ...typography.eyebrow,
    color: colors.accentOnDark,
    textTransform: "uppercase",
    marginBottom: spacing.lg,
  },
  brandTitle: {
    color: colors.inverse,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  brandDescription: {
    ...typography.body,
    color: "#B7C6BF",
    maxWidth: 340,
    marginTop: spacing.lg,
  },
  accentLine: {
    width: 96,
    height: 2,
    backgroundColor: colors.accent,
    marginBottom: spacing.md,
  },
  brandFootnote: {
    ...typography.metadata,
    color: "#82998E",
  },
  formPanel: {
    flex: 1,
    paddingHorizontal: screen.mobilePadding,
    paddingTop: spacing.xl,
    paddingBottom: 48,
  },
  formPanelDesktop: {
    justifyContent: "center",
    paddingHorizontal: 56,
    paddingVertical: 48,
  },
  formContent: {
    width: "100%",
    alignSelf: "center",
  },
  mobileLogo: {
    marginBottom: spacing.xl,
  },
  overline: {
    ...typography.eyebrow,
    color: colors.accentText,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.screenTitle,
    color: colors.ink,
  },
  subtitle: {
    ...typography.subtitle,
    color: colors.muted,
    maxWidth: 560,
    marginTop: spacing.sm,
  },
  content: {
    marginTop: spacing.xl,
  },
});
