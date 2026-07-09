import React from "react";
import type { KeyboardTypeOptions, StyleProp, ViewStyle } from "react-native";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Calendar, Clock } from "lucide-react-native";
import { colors, radii, spacing } from "../theme";

interface DateTimeInputProps {
  type: "date" | "time";
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  maxLength?: number;
  keyboardType?: KeyboardTypeOptions;
  containerStyle?: StyleProp<ViewStyle>;
}

export function DateTimeInput({
  type,
  value,
  onChange,
  label,
  placeholder,
  maxLength,
  keyboardType = "number-pad",
  containerStyle,
}: DateTimeInputProps) {
  const Icon = type === "date" ? Calendar : Clock;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder ?? (type === "date" ? "DD/MM/AAAA" : "HH:mm")}
          placeholderTextColor={colors.muted}
          keyboardType={keyboardType}
          maxLength={maxLength}
        />
        <Icon color={colors.muted} size={20} strokeWidth={2.3} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  inputWrapper: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    minHeight: 50,
    color: colors.ink,
    fontSize: 15,
    paddingVertical: 0,
  },
});
