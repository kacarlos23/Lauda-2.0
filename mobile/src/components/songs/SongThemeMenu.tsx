import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, findNodeHandle, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { Check } from "lucide-react-native";
import { SUGGESTED_SONG_TAGS } from "../../../../src/constants/songTags";
import { normalizeCatalogText } from "../../../../src/utils/catalogNormalization";
import { useThemeStore } from "../../store/themeStore";
import { colors, fontSizes, fontWeights, iconSizes, motion, radiusValues, shadow, spacing } from "../../theme";
import { BottomSheet } from "../BottomSheet";
import { songThemeColors } from "../../tokens/songThemes";

export type SongThemeAnchor = { x: number; y: number; width: number; height: number };

export function focusSongThemeControl(target: View | null) {
  if (!target) return;
  if (Platform.OS === "web") {
    (target as View & { focus?: () => void }).focus?.();
  } else if (typeof AccessibilityInfo?.setAccessibilityFocus === "function" && typeof findNodeHandle === "function") {
    const handle = findNodeHandle(target);
    if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
  }
}

const FirstItemContext = createContext<React.RefObject<View | null> | undefined>(undefined);

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
  optionLabels?: ReadonlyMap<string, string>;
  checked: ReadonlySet<string>;
  disabled?: boolean;
  onToggle: (name: string) => void;
};

function isKeyboardFocusEvent(event: unknown): boolean {
  if (Platform.OS !== "web") return false;
  const target = (event as { currentTarget?: { matches?: (selector: string) => boolean }; target?: { matches?: (selector: string) => boolean } } | undefined)?.currentTarget
    ?? (event as { target?: { matches?: (selector: string) => boolean } } | undefined)?.target;
  if (typeof target?.matches === "function") {
    return target.matches(":focus-visible");
  }
  return true;
}

export function SongThemeChecklist({ options, optionLabels, checked, disabled, onToggle }: ChecklistProps) {
  const dark = useThemeStore((state) => state.mode === "dark");
  const firstItem = useContext(FirstItemContext);
  const [focused, setFocused] = useState<string | null>(null);
  return (
    <View style={styles.checklist}>
      {options.map((name, index) => {
        const key = normalizeCatalogText(name);
        const active = checked.has(key);
        const label = optionLabels?.get(key) ?? name;
        return (
          <TouchableOpacity
            key={key}
            ref={index === 0 ? firstItem : undefined}
            onPress={() => onToggle(name)}
            disabled={disabled}
            accessibilityRole="checkbox"
            accessibilityLabel={label}
            accessibilityState={{ checked: active, disabled }}
            aria-checked={active}
            onFocus={(event) => { if (isKeyboardFocusEvent(event)) setFocused(key); }}
            onBlur={() => setFocused(null)}
            style={[styles.option, focused === key && styles.optionFocused]}
          >
            <View style={[styles.checkbox, active && styles.checkboxActive]}>
              {active ? <Check color={colors.surface} size={iconSizes.s13} strokeWidth={3} /> : null}
            </View>
            <View style={[styles.dot, { backgroundColor: songThemeColors(name, dark).ink }]} />
            <Text style={styles.optionName}>{label}</Text>
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
  const canQueryReducedMotion = typeof AccessibilityInfo?.isReduceMotionEnabled === "function";
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(() => (canQueryReducedMotion ? null : false));
  const progress = useRef(new Animated.Value(0)).current;
  const firstItem = useRef<View>(null);
  const [closing, setClosing] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const close = useCallback(() => setClosing(true), []);
  const finishClose = useCallback(() => {
    closeRef.current();
    // A caller may keep the menu open while a batch operation is pending.
    setClosing(false);
  }, []);
  const focusFirstItem = useCallback(() => focusSongThemeControl(firstItem.current), []);

  useEffect(() => {
    let mounted = true;
    if (typeof AccessibilityInfo?.isReduceMotionEnabled === "function") {
      void AccessibilityInfo.isReduceMotionEnabled().then(
        (enabled) => { if (mounted) setReducedMotion(enabled); },
        () => { if (mounted) setReducedMotion(true); },
      );
    }
    const subscription = typeof AccessibilityInfo?.addEventListener === "function"
      ? AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion)
      : undefined;
    return () => { mounted = false; subscription?.remove?.(); };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || closing || typeof document === "undefined") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [close, closing]);

  useEffect(() => {
    if (!anchor || reducedMotion == null) return;
    if (reducedMotion) {
      progress.setValue(closing ? 0 : 1);
      if (closing) finishClose();
      return;
    }
    const easing = typeof Easing?.bezier === "function" ? Easing.bezier(0.22, 1, 0.36, 1) : undefined;
    const animation = Animated.timing(progress, {
      toValue: closing ? 0 : 1,
      duration: motion.interactionMs,
      easing,
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start(({ finished }) => {
      if (finished && closing) finishClose();
    });
    return () => animation.stop();
  }, [anchor, closing, finishClose, progress, reducedMotion]);

  // Resolve the setting before presenting, including the first animation frame.
  if (reducedMotion == null) return null;

  const menu = (
    <View accessibilityRole="menu" accessibilityLabel={title}>
      <FirstItemContext.Provider value={firstItem}>{children}</FirstItemContext.Provider>
    </View>
  );
  const hint = note ? <Text style={styles.note}>{note}</Text> : null;
  if (!anchor) {
    return (
      <BottomSheet isOpen={!closing} title={title} onClose={close} onClosed={finishClose}
        onShow={focusFirstItem} reduceMotion={reducedMotion} openDuration={340} closeDuration={220} sheetStyle={styles.sheet} footer={footer}>
        {hint ? <View style={styles.sheetNote}>{hint}</View> : null}
        {menu}
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
    <Modal visible transparent animationType="none" onRequestClose={close} onShow={focusFirstItem}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable testID="song-theme-backdrop" style={StyleSheet.absoluteFill} onPress={close} accessible={false} />
        <Animated.View
          style={[styles.popover, { width: menuWidth, left, maxHeight: Math.max(120, opensBelow ? below : above),
            opacity: progress,
            transform: [{ translateY: typeof progress.interpolate === "function" ? progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) : 0 }],
          }, placement]}
          accessibilityViewIsModal
          accessibilityLabel={title}
          testID="song-theme-popover"
        >
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">{title}</Text>
            {hint}
          </View>
          <ScrollView style={styles.popoverScroll} keyboardShouldPersistTaps="handled">
            {menu}
          </ScrollView>
          {footer ? <View style={styles.popoverFooter}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  checklist: { paddingHorizontal: spacing.md },
  option: { minHeight: 44, minWidth: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.xs, borderRadius: radiusValues.r4 },
  optionFocused: { backgroundColor: colors.primarySoft },
  optionName: { color: colors.text, fontSize: fontSizes.s13, flexShrink: 1 },
  checkbox: {
    width: 16, height: 16, borderRadius: radiusValues.r2,
    borderWidth: 1, borderColor: colors.muted, alignItems: "center", justifyContent: "center",
  },
  checkboxActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  dot: { width: 7, height: 7, borderRadius: radiusValues.r4 },
  sheet: { borderTopLeftRadius: radiusValues.r16, borderTopRightRadius: radiusValues.r16, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
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
