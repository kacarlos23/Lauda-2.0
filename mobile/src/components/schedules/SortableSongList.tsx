import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, PanResponder, Platform, StyleSheet, Text, View } from "react-native";
import { GripVertical } from "lucide-react-native";
import { colors, iconSizes, motion, spacing, typography } from "../../theme";

export function moveListItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function DragHandle({ label, disabled, onStart, onMove, onEnd }: {
  label: string; disabled: boolean; onStart: () => void; onMove: (y: number, dx: number, dy: number) => void; onEnd: (commit: boolean) => void;
}) {
  const latest = useRef({ disabled, onStart, onMove, onEnd });
  latest.current = { disabled, onStart, onMove, onEnd };
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !latest.current.disabled,
    onMoveShouldSetPanResponder: () => !latest.current.disabled,
    onPanResponderGrant: () => latest.current.onStart(),
    onPanResponderMove: (_, gesture) => latest.current.onMove(gesture.moveY, gesture.dx, gesture.dy),
    onPanResponderRelease: () => latest.current.onEnd(true),
    onPanResponderTerminate: () => latest.current.onEnd(false),
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
  })).current;
  return <View {...responder.panHandlers} accessible accessibilityLabel={`Arrastar ${label}`} accessibilityHint="Arraste até a posição desejada. Use as setas para ordenar sem arrastar."
    testID={`drag-${label}`} style={[styles.handle, Platform.OS === "web" ? { cursor: disabled ? "default" : "grab", touchAction: "none", userSelect: "none" } as any : null]}>
    <GripVertical size={iconSizes.s20} color={colors.muted} /><Text style={styles.hint}>Arrastar para ordenar</Text>
  </View>;
}

export function SortableSongList<T>({ items, itemKey, itemLabel, onMove, disabled = false, renderItem }: {
  items: T[]; itemKey: (item: T) => string; itemLabel: (item: T) => string;
  onMove: (from: number, to: number) => void; disabled?: boolean; renderItem: (item: T, index: number) => React.ReactNode;
}) {
  const refs = useRef(new Map<string, View>());
  const translations = useRef(new Map<string, Animated.ValueXY>());
  const reducedMotion = useRef(false);
  const drag = useRef<{ from: number; to: number; dx: number; dy: number; rows: { index: number; key: string; y: number; height: number }[] } | null>(null);
  const pending = useRef<{ keys: string[]; offsets: Map<string, { x: number; y: number }> } | null>(null);
  const [feedback, setFeedback] = useState<{ from: number; to: number } | null>(null);
  const [elevatedKey, setElevatedKey] = useState<string | null>(null);
  const keys = items.map(itemKey);
  const keyOrder = JSON.stringify(keys);
  function translation(key: string) {
    let value = translations.current.get(key);
    if (!value) { value = new Animated.ValueXY({ x: 0, y: 0 }); translations.current.set(key, value); }
    return value;
  }
  function settle(value: Animated.ValueXY, complete?: () => void) {
    Animated.timing(value, {
      toValue: { x: 0, y: 0 }, duration: reducedMotion.current ? 0 : motion.sheetCloseMs,
      easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web",
    }).start(({ finished }) => { if (finished) complete?.(); });
  }
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo?.isReduceMotionEnabled?.().then((enabled) => { if (mounted) reducedMotion.current = enabled; });
    const listener = AccessibilityInfo?.addEventListener?.("reduceMotionChanged", (enabled) => { reducedMotion.current = enabled; });
    return () => { mounted = false; listener?.remove(); translations.current.forEach((value) => value.stopAnimation()); };
  }, []);
  // Invert the new layout before paint, then slide every displaced row to its destination.
  // Measured heights keep cards with different moments/descriptions aligned throughout the move.
  useLayoutEffect(() => {
    const next = pending.current;
    if (!next || JSON.stringify(next.keys) !== keyOrder) return;
    pending.current = null;
    next.offsets.forEach((offset, key) => {
      const value = translation(key);
      value.setValue(offset);
      settle(value, key === elevatedKey ? () => setElevatedKey(null) : undefined);
    });
  }, [keyOrder, elevatedKey]);
  function start(from: number) {
    pending.current = null;
    translations.current.forEach((value) => { value.stopAnimation(); value.setValue({ x: 0, y: 0 }); });
    const current = { from, to: from, dx: 0, dy: 0, rows: [] as { index: number; key: string; y: number; height: number }[] };
    drag.current = current;
    setElevatedKey(keys[from]); setFeedback({ from, to: from });
    items.forEach((item, index) => refs.current.get(itemKey(item))?.measureInWindow((_, y, __, height) => {
      if (drag.current === current) current.rows.push({ index, key: itemKey(item), y, height });
    }));
  }
  function move(y: number, dx: number, dy: number) {
    const current = drag.current;
    if (!current) return;
    current.dx = dx; current.dy = dy;
    translation(keys[current.from]).setValue({ x: dx, y: dy });
    if (!current.rows.length) return;
    const closest = current.rows.reduce((a, b) => Math.abs(a.y + a.height / 2 - y) <= Math.abs(b.y + b.height / 2 - y) ? a : b);
    if (current.to !== closest.index) {
      current.to = closest.index;
      setFeedback({ from: current.from, to: current.to });
    }
  }
  function end(commit: boolean) {
    const current = drag.current;
    drag.current = null; setFeedback(null);
    if (!current) return;
    if (commit && !disabled && current.from !== current.to && current.rows.length === items.length) {
      const rows = [...current.rows].sort((a, b) => a.index - b.index);
      const reordered = moveListItem(rows, current.from, current.to);
      let y = rows[0].y;
      const offsets = new Map<string, { x: number; y: number }>();
      reordered.forEach((row) => {
        const active = row.index === current.from;
        offsets.set(row.key, { x: active ? current.dx : 0, y: row.y - y + (active ? current.dy : 0) });
        y += row.height + spacing.md;
      });
      pending.current = { keys: reordered.map((row) => row.key), offsets };
      onMove(current.from, current.to);
    } else {
      settle(translation(keys[current.from]), () => setElevatedKey(null));
    }
  }
  return <View style={styles.list}>{items.map((item, index) => <View key={itemKey(item)} testID={`sortable-${itemKey(item)}`}
    ref={(node) => { if (node) refs.current.set(itemKey(item), node); else refs.current.delete(itemKey(item)); }} collapsable={false}
    style={elevatedKey === itemKey(item) ? styles.elevated : undefined}>
    <Animated.View testID={`sortable-motion-${itemKey(item)}`} style={[styles.row, { transform: translation(itemKey(item)).getTranslateTransform() },
      feedback?.from === index && styles.dragging, feedback?.to === index && feedback.from !== index && styles.target]}>
      {!disabled && items.length > 1 ? <DragHandle label={itemLabel(item)} disabled={disabled} onStart={() => start(index)} onMove={move} onEnd={end} /> : null}
      {renderItem(item, index)}
    </Animated.View>
  </View>)}</View>;
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, width: "100%" }, row: { gap: spacing.xs },
  handle: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start", paddingHorizontal: spacing.sm },
  hint: { ...typography.metadata, color: colors.muted },
  elevated: { zIndex: 10, elevation: 10 }, dragging: { opacity: 0.96 }, target: { backgroundColor: colors.primarySoft },
});
