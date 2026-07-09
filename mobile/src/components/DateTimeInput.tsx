import React, { useState } from "react";
import type { KeyboardTypeOptions, StyleProp, ViewStyle } from "react-native";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Calendar, Clock } from "lucide-react-native";
import { colors, radii, spacing } from "../theme";
import { maskDateInput, maskTimeInput } from "../utils/dateTimeInput";

interface DateTimeInputProps {
  type: "date" | "time";
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  maxLength?: number;
  keyboardType?: KeyboardTypeOptions;
  containerStyle?: StyleProp<ViewStyle>;
  error?: string;
  maskInput?: boolean;
  testID?: string;
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
  error,
  maskInput = true,
  testID,
}: DateTimeInputProps) {
  const Icon = type === "date" ? Calendar : Clock;
  const [focused, setFocused] = useState(false);
  const resolvedMaxLength = maxLength ?? (type === "date" ? 10 : 5);

  const handleChange = (nextValue: string) => {
    if (!maskInput) {
      onChange(nextValue);
      return;
    }

    onChange(type === "date" ? maskDateInput(nextValue) : maskTimeInput(nextValue));
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputWrapper, focused && styles.inputWrapperFocused, error && styles.inputWrapperError]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder ?? (type === "date" ? "DD/MM/AAAA" : "HH:MM")}
          placeholderTextColor={colors.muted}
          keyboardType={keyboardType}
          maxLength={maskInput ? resolvedMaxLength : maxLength}
          testID={testID}
        />
        <View style={styles.iconBox}>
          <Icon color={colors.muted} size={20} strokeWidth={2.3} />
        </View>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  inputWrapperFocused: {
    borderColor: colors.primary,
  },
  inputWrapperError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    minHeight: 50,
    color: colors.ink,
    fontSize: 15,
    padding: spacing.md,
  },
  iconBox: {
    paddingRight: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
});
