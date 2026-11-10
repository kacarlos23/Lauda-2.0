import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { Check } from "lucide-react-native";
import { SUGGESTED_SONG_TAGS } from "../../../../src/constants/songTags";
import { normalizeCatalogText } from "../../../../src/utils/catalogNormalization";
import { useThemeStore } from "../../store/themeStore";
import { colors, fontSizes, fontWeights, iconSizes, radiusValues, shadow, spacing } from "../../theme";
import { BottomSheet } from "../BottomSheet";
import { songThemeColors } from "../../tokens/songThemes";

export type SongThemeAnchor = { x: number; y: number; width: number; height: number };

export function songThemeOptions(names: readonly string[]): string[] {
  const options = new Map(SUGGESTED_SONG_TAGS.map((name) => [normalizeCatalogText(name), name] as [string, string]));
  for (const name of [...names].sort((a, b) => a.localeCompare(b, "pt-BR"))) {
    const key = normalizeCatalogText(name);
    if (!options.has(key)) options.set(key, name);
  }
  return [...options.values()];
}

type ChecklistProps = {
  options: string[];
  checked: ReadonlySet<string>;
  disabled?: boolean;
  onToggle: (name: string) => void;
};

export function SongThemeChecklist({ options, checked, disabled, onToggle }: ChecklistProps) {
  const dark = useThemeStore((state) => state.mode === "dark");
  return (
    <View style={styles.checklist}>
      {options.map((name) => {
        const key = normalizeCatalogText(name);
        const active = checked.has(key);
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onToggle(name)}
            disabled={disabled}
            accessibilityRole="checkbox"
            accessibilityLabel={name}
            accessibilityState={{ checked: active, disabled }}
            aria-checked={active}
            style={styles.option}
          >
            <View style={[styles.checkbox, active && styles.checkboxActive]}>
              {active ? <Check color={colors.surface} size={iconSizes.s13} strokeWidth={3} /> : null}
            </View>
            <View style={[styles.dot, { backgroundColor: songThemeColors(name, dark).ink }]} />
            <Text style={styles.optionName}>{name}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

type MenuProps = {
  title: string;
  anchor: SongThemeAnchor | null;
  note?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
};

export function SongThemeMenu({ title, anchor, note, footer, children, onClose }: MenuProps) {
  const { width, height } = useWindowDimensions();
  const hint = note ? <Text style={styles.note}>{note}</Text> : null;
  if (!anchor) {
    return (
      <BottomSheet isOpen title={title} onClose={onClose} sheetStyle={styles.sheet} footer={footer}>
        {hint ? <View style={styles.sheetNote}>{hint}</View> : null}
        {children}
      </BottomSheet>
    );
  }

  const margin = spacing.sm;
  const menuWidth = Math.min(width - 2 * margin, 326);
  const left = Math.max(margin, Math.min(anchor.x + anchor.width - menuWidth, width - menuWidth - margin));
  const below = height - anchor.y - anchor.height - 2 * margin;
  const above = anchor.y - 2 * margin;
  const opensBelow = below >= 500 || below >= above;
  const placement = opensBelow ? { top: anchor.y + anchor.height + margin } : { bottom: height - anchor.y + margin };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
        <View
          style={[styles.popover, { width: menuWidth, left, maxHeight: Math.max(120, opensBelow ? below : above) }, placement]}
          accessibilityViewIsModal
          accessibilityLabel={title}
          testID="song-theme-popover"
        >
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">{title}</Text>
            {hint}
          </View>
          <ScrollView style={styles.popoverScroll} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.popoverFooter}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  checklist: { paddingHorizontal: spacing.md },
  option: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xxs },
  optionName: { color: colors.text, fontSize: fontSizes.s13, flexShrink: 1 },
  checkbox: {
    width: 16, height: 16, borderRadius: radiusValues.r2,
    borderWidth: 1, borderColor: colors.muted, alignItems: "center", justifyContent: "center",
  },
  checkboxActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  dot: { width: 7, height: 7, borderRadius: radiusValues.r4 },
  sheet: { borderRadius: radiusValues.r4, borderTopLeftRadius: radiusValues.r4, borderTopRightRadius: radiusValues.r4 },
  sheetNote: { paddingTop: spacing.xs, paddingHorizontal: spacing.md, alignItems: "flex-end" },
  popover: {
    position: "absolute", backgroundColor: colors.surface, borderWidth: 1,
    borderColor: colors.lineStrong, borderRadius: radiusValues.r4, ...shadow,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm, padding: spacing.md },
  title: { color: colors.ink, fontSize: fontSizes.s15, fontWeight: fontWeights.extrabold },
  note: { color: colors.muted, fontSize: fontSizes.s11 },
  popoverScroll: { flexGrow: 0, flexShrink: 1 },
  popoverFooter: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: spacing.xs, padding: spacing.sm },
});
