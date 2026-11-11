import React, { useEffect, useRef, useState } from "react";
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Check, Tag, UserRound } from "lucide-react-native";
import { Song } from "../../types";
import { hasSongLinks, SongLinkButtons } from "../SongLinkButtons";
import { SongThemeLabels } from "./SongThemeLabels";
import { focusSongThemeControl, type SongThemeAnchor } from "./SongThemeMenu";
import {
  colors,
  controlSizes,
  fontSizes,
  fontWeights,
  iconSizes,
  radiusValues,
  spacing,
} from "../../theme";

type Props = {
  song: Song;
  selectionMode: boolean;
  selected: boolean;
  isLast: boolean;
  compactLinkActions?: boolean;
  editingThemes?: boolean;
  onEditThemes?: (anchor: SongThemeAnchor | null) => void;
  onOpenLinks?: () => void;
  onPress: () => void;
};

export function SongListRow({
  song,
  selectionMode,
  selected,
  isLast,
  compactLinkActions = false,
  editingThemes = false,
  onEditThemes,
  onOpenLinks,
  onPress,
}: Props) {
  const themeButton = useRef<View>(null);
  const addThemeButton = useRef<View>(null);
  const opener = useRef<React.RefObject<View | null>>(themeButton);
  const wasEditing = useRef(false);
  const [focused, setFocused] = useState<"edit" | "add" | null>(null);
  useEffect(() => {
    const restore = wasEditing.current && !editingThemes;
    wasEditing.current = editingThemes;
    if (!restore) return;
    const frame = requestAnimationFrame(() => focusSongThemeControl(opener.current.current ?? themeButton.current));
    return () => cancelAnimationFrame(frame);
  }, [editingThemes]);
  const selectionLabel = `${selected ? "Desmarcar" : "Selecionar"} ${song.title}`;
  const showLinks = hasSongLinks(song);
  const openThemes = (trigger: React.RefObject<View | null>) => {
    opener.current = trigger;
    if (Platform.OS !== "web" || compactLinkActions || !trigger.current) {
      onEditThemes?.(null);
      return;
    }
    trigger.current.measureInWindow((x, y, width, height) => {
      onEditThemes?.({ x, y, width, height });
    });
  };
  const themes = !song.tags?.length && onEditThemes ? (
    <TouchableOpacity ref={addThemeButton} onPress={() => openThemes(addThemeButton)}
      accessibilityRole="button" accessibilityLabel={`Adicionar tema a ${song.title}`}
      accessibilityState={{ expanded: editingThemes }} aria-expanded={editingThemes}
      onFocus={() => { if (Platform.OS === "web") setFocused("add"); }} onBlur={() => setFocused(null)}
      style={[styles.addThemeButton, focused === "add" && styles.themeButtonFocused]}>
      <SongThemeLabels tags={[]} />
    </TouchableOpacity>
  ) : <SongThemeLabels tags={song.tags} />;

  return (
    <View
      style={[styles.row, compactLinkActions && styles.rowCompact, !isLast && styles.rowBorder, selected && styles.rowSelected]}
      testID={`song-row-${song.id}`}
    >
      {selected ? <View style={styles.selectedRail} /> : null}
      <View style={styles.headline}>
        <TouchableOpacity
          style={[styles.identity, !compactLinkActions && styles.desktopIdentity]}
          testID={`song-row-control-${song.id}`}
          onPress={onPress}
          accessibilityRole={selectionMode ? "checkbox" : "button"}
          accessibilityLabel={selectionMode ? selectionLabel : `Abrir cifra ${song.title}`}
          accessibilityState={selectionMode ? { checked: selected } : undefined}
          aria-checked={selectionMode ? selected : undefined}
        >
          {selectionMode ? (
            <View style={[styles.check, selected && styles.checkSelected]}>
              {selected ? <Check color={colors.surface} size={iconSizes.s15} strokeWidth={2.8} /> : null}
            </View>
          ) : null}
          {song.artist.imageUrl ? (
            <Image source={{ uri: song.artist.imageUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}><UserRound color={colors.primary} size={iconSizes.s19} /></View>
          )}
          <View style={styles.info} testID={`song-info-${song.id}`}>
            <Text style={styles.songTitle} numberOfLines={1}>{song.title}</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {song.artist.name} · Tom {song.originalKey}{song.bpm ? ` · ${song.bpm} BPM` : ""}
            </Text>
          </View>
        </TouchableOpacity>
        {!compactLinkActions ? <View style={styles.desktopThemes}>{themes}</View> : null}
        {showLinks || onEditThemes ? (
          <View style={styles.actions} testID={`song-actions-${song.id}`}>
            {onEditThemes ? (
              <TouchableOpacity
                ref={themeButton}
                style={[styles.themeButton, editingThemes && styles.themeButtonActive, focused === "edit" && styles.themeButtonFocused]}
                onPress={() => openThemes(themeButton)}
                onFocus={() => { if (Platform.OS === "web") setFocused("edit"); }}
                onBlur={() => setFocused(null)}
                accessibilityRole="button"
                accessibilityLabel={`Editar temas de ${song.title}`}
                accessibilityState={{ expanded: editingThemes }}
                aria-expanded={editingThemes}
              >
                <Tag color={colors.primary} size={iconSizes.s16} />
              </TouchableOpacity>
            ) : null}
            {showLinks ? (
              <SongLinkButtons links={song} compact collapseMultiple={compactLinkActions} onOpenMultiple={onOpenLinks} />
            ) : null}
          </View>
        ) : null}
      </View>
      {compactLinkActions ? <View style={[styles.mobileThemes, selectionMode && styles.mobileThemesSelected]}>{themes}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 66,
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.control,
    backgroundColor: colors.surface,
    position: "relative",
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowCompact: {
    minHeight: 76,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  rowSelected: { backgroundColor: colors.primarySoft },
  selectedRail: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.primary,
  },
  headline: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  identity: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  desktopIdentity: { minWidth: 144 },
  avatar: { width: controlSizes.medium, height: controlSizes.medium, borderRadius: radiusValues.r20, backgroundColor: colors.surfaceMuted },
  avatarPlaceholder: {
    width: controlSizes.medium,
    height: controlSizes.medium,
    borderRadius: radiusValues.r20,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, minWidth: 0 },
  desktopThemes: { flexShrink: 1, maxWidth: "48%" },
  mobileThemes: { marginLeft: controlSizes.medium + spacing.sm },
  mobileThemesSelected: { marginLeft: controlSizes.medium + 20 + 2 * spacing.sm },
  actions: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  themeButton: {
    width: 44, height: 44, borderRadius: radiusValues.r4, borderWidth: 1,
    borderColor: colors.line, alignItems: "center", justifyContent: "center",
  },
  themeButtonActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  themeButtonFocused: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  addThemeButton: { minWidth: 44, minHeight: 44, justifyContent: "center", borderWidth: 1, borderColor: "transparent", borderRadius: radiusValues.r4 },
  songTitle: { color: colors.ink, fontSize: fontSizes.s15, fontWeight: fontWeights.bold },
  meta: { color: colors.muted, fontSize: fontSizes.s12, marginTop: spacing.micro },
  check: {
    width: 20,
    height: 20,
    borderRadius: radiusValues.r2,
    borderWidth: 1,
    borderColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  checkSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
});
