import React from "react";
import { StyleProp, StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import { Search, X } from "lucide-react-native";
import { colors, controlSizes, iconSizes } from "../../theme";
import { AppInput } from "./AppInput";

type SearchFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  label?: string;
  accessibilityLabel?: string;
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

export function SearchField({
  value,
  onChangeText,
  placeholder = "Buscar",
  label,
  accessibilityLabel = "Buscar",
  containerStyle,
  testID,
}: SearchFieldProps) {
  return (
    <AppInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      label={label}
      accessibilityLabel={accessibilityLabel}
      autoCapitalize="none"
      autoCorrect={false}
      testID={testID}
      icon={<Search color={colors.muted} size={iconSizes.s18} strokeWidth={2} />}
      endAdornment={value ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Limpar busca"
          hitSlop={8}
          style={styles.clear}
          onPress={() => onChangeText("")}
        >
          <X color={colors.muted} size={iconSizes.s17} strokeWidth={2.2} />
        </TouchableOpacity>
      ) : null}
      containerStyle={containerStyle}
    />
  );
}

const styles = StyleSheet.create({
  clear: {
    width: 32,
    height: controlSizes.medium,
    alignItems: "center",
    justifyContent: "center",
  },
});
