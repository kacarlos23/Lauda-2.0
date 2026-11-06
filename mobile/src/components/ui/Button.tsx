import React from "react";
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewStyle,
} from "react-native";
import { colors, controlSizes, spacing, typography } from "../../theme";
import { uiPatterns } from "./patterns";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = TouchableOpacityProps & {
  title: string;
  icon?: React.ReactNode;
  loading?: boolean;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function Button({
  title,
  icon,
  loading = false,
  variant = "primary",
  size = "md",
  disabled,
  style,
  textStyle,
  accessibilityRole = "button",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const foreground = variant === "primary" || variant === "danger" ? colors.surface : colors.primary;
  const actionIcon = React.isValidElement<{ color?: string }>(icon) ? React.cloneElement(icon, { color: foreground }) : icon;

  return (
    <TouchableOpacity
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: Boolean(isDisabled) }}
      disabled={isDisabled}
      activeOpacity={0.78}
      style={[
        styles.base,
        styles[size],
        variantStyles[variant],
        isDisabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" || variant === "danger" ? colors.surface : colors.primary} />
      ) : (
        <View style={styles.content}>
          {actionIcon}
          <Text style={[styles.text, textVariantStyles[variant], textStyle]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    ...uiPatterns.action,
    flexShrink: 1,
  },
  sm: {
    minHeight: controlSizes.default,
    paddingHorizontal: spacing.md,
  },
  md: {
    minHeight: controlSizes.default,
    paddingHorizontal: spacing.lg,
  },
  lg: {
    minHeight: controlSizes.default,
    paddingHorizontal: spacing.xl,
  },
  disabled: {
    opacity: 0.6,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  text: {
    ...typography.button,
  },
});

const variantStyles = StyleSheet.create({
  primary: {
    ...uiPatterns.primaryAction,
  },
  secondary: {
    ...uiPatterns.secondaryAction,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  danger: {
    backgroundColor: colors.danger,
  },
});

const textVariantStyles = StyleSheet.create({
  primary: {
    color: colors.surface,
  },
  secondary: {
    color: colors.primary,
  },
  ghost: {
    color: colors.primaryDark,
  },
  danger: {
    color: colors.surface,
  },
});
