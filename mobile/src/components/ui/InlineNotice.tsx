import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, radii, spacing, typography } from "../../theme";

type NoticeTone = "info" | "success" | "warning" | "danger";

type InlineNoticeProps = {
  title?: string;
  message: string;
  tone?: NoticeTone;
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function InlineNotice({
  title,
  message,
  tone = "info",
  action,
  style,
  testID,
}: InlineNoticeProps) {
  return (
    <View
      style={[styles.notice, toneStyles[tone], style]}
      accessibilityRole={tone === "danger" ? "alert" : undefined}
      testID={testID}
    >
      <View style={styles.copy}>
        {title ? <Text style={[styles.title, textToneStyles[tone]]}>{title}</Text> : null}
        <Text style={[styles.message, textToneStyles[tone]]}>{message}</Text>
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderLeftWidth: 3,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  copy: { flex: 1 },
  title: { ...typography.label, marginBottom: spacing.xxs },
  message: { ...typography.metadata },
});

const toneStyles = StyleSheet.create({
  info: { backgroundColor: colors.infoSoft, borderLeftColor: colors.info },
  success: { backgroundColor: colors.successSoft, borderLeftColor: colors.success },
  warning: { backgroundColor: colors.warningSoft, borderLeftColor: colors.warning },
  danger: { backgroundColor: colors.dangerSoft, borderLeftColor: colors.danger },
});

const textToneStyles = StyleSheet.create({
  info: { color: colors.primaryDark },
  success: { color: colors.success },
  warning: { color: "#6E4813" },
  danger: { color: colors.danger },
});
