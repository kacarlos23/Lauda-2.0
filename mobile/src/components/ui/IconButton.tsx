import React from "react";
import { StyleProp, StyleSheet, TouchableOpacity, TouchableOpacityProps, ViewStyle } from "react-native";
import { colors, controlSizes, overlays, radii } from "../../theme";

type IconButtonProps = Omit<TouchableOpacityProps, "children" | "style"> & {
  icon: React.ReactNode;
  label: string;
  tone?: "default" | "danger" | "inverse";
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  icon,
  label,
  tone = "default",
  style,
  disabled,
  ...props
}: IconButtonProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      activeOpacity={0.72}
      disabled={disabled}
      style={[
        styles.button,
        tone === "danger" && styles.danger,
        tone === "inverse" && styles.inverse,
        disabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {icon}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: controlSizes.default,
    height: controlSizes.default,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  danger: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  inverse: {
    borderColor: overlays.inverseIconBorder,
    backgroundColor: overlays.inverseIconSurface,
  },
  disabled: { opacity: 0.52 },
});
