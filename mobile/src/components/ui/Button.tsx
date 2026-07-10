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
import { buttonShadow, colors, radii, spacing, typography } from "../../theme";

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

  return (
    <TouchableOpacity
      accessibilityRole={accessibilityRole}
      disabled={isDisabled}
      style={[
        styles.base,
        styles[size],
        variantStyles[variant],
        variant === "primary" && styles.primaryShadow,
        isDisabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" || variant === "danger" ? colors.surface : colors.primary} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[styles.text, textVariantStyles[variant], textStyle]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  sm: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
  },
  md: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  lg: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  primaryShadow: {
    ...buttonShadow,
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
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.primarySoft,
  },
  ghost: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.line,
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
    color: colors.text,
  },
  danger: {
    color: colors.surface,
  },
});
