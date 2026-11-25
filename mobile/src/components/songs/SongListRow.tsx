import React, { useEffect, useRef, useState } from "react";
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Check, MoreHorizontal, MoreVertical, Music2, Plus, UserRound } from "lucide-react-native";
import { Song } from "../../types";
import { focusSongThemeControl, type SongThemeAnchor } from "./SongThemeMenu";
import {
  colors,
  controlSizes,
  fontSizes,
  fontWeights,
  iconSizes,
  radii,
  spacing,
} from "../../theme";

type Props = {
  song: Song;
  selectionMode: boolean;
  selected: boolean;
  isLast: boolean;
  compactLinkActions?: boolean;
  editingThemes?: boolean;
  menuOpen?: boolean;
  rowNumber?: number;
  onEditThemes?: (anchor: SongThemeAnchor | null) => void;
  onOpenMenu?: (anchor: SongThemeAnchor | null) => void;
  onOpenLinks?: () => void;
  onPress: () => void;
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

export function SongListRow({
  song,
  selectionMode,
  selected,
  isLast: _isLast,
  compactLinkActions = false,
  editingThemes = false,
  menuOpen = false,
  rowNumber,
  onEditThemes,
  onOpenMenu,
  onPress,
}: Props) {
  const themeButton = useRef<View>(null);
  const menuButton = useRef<View>(null);
  const wasEditing = useRef(false);
  const wasMenuOpen = useRef(false);
  const [focused, setFocused] = useState<"theme" | "menu" | null>(null);
  const [rowHovered, setRowHovered] = useState(false);

  useEffect(() => {
    const restore = wasEditing.current && !editingThemes;
    wasEditing.current = editingThemes;
    if (!restore) return;
    if (typeof requestAnimationFrame === "function") {
      const frame = requestAnimationFrame(() => focusSongThemeControl(themeButton.current));
      return () => {
        if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
      };
    }
    focusSongThemeControl(themeButton.current);
    return undefined;
  }, [editingThemes]);

  useEffect(() => {
    const restore = wasMenuOpen.current && !menuOpen && !editingThemes;
    wasMenuOpen.current = menuOpen;
    if (!restore) return;
    if (typeof requestAnimationFrame === "function") {
      const frame = requestAnimationFrame(() => focusSongThemeControl(menuButton.current));
      return () => {
        if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
      };
    }
    focusSongThemeControl(menuButton.current);
    return undefined;
  }, [menuOpen, editingThemes]);

  const tags = song.tags ?? [];
  const hasTags = tags.length > 0;
  const selectionLabel = `${selected ? "Desmarcar" : "Selecionar"} ${song.title}`;
  const themeTooltip = hasTags ? `Etiquetas: ${tags.join(", ")}` : "Adicionar etiquetas";
  const themeAccessibilityLabel = hasTags ? `Editar temas de ${song.title}` : `Adicionar tema a ${song.title}`;

  const measureAndOpen = (
    trigger: React.RefObject<View | null>,
    callback?: (anchor: SongThemeAnchor | null) => void,
  ) => {
    if (!callback) return;
    if (Platform.OS !== "web" || compactLinkActions || !trigger.current) {
      callback(null);
      return;
    }
    trigger.current.measureInWindow((x, y, width, height) => {
      callback({ x, y, width, height });
    });
  };

  const webHoverProps = Platform.OS === "web"
    ? ({
        onMouseEnter: () => setRowHovered(true),
        onMouseLeave: () => setRowHovered(false),
      } as Record<string, unknown>)
    : {};

  const circleVisual = (
    <View style={[styles.tagCircle, hasTags ? styles.tagCircleFilled : styles.tagCircleEmpty]}>
      {hasTags ? (
        <Check color={colors.surface} size={iconSizes.s13} strokeWidth={3} />
      ) : (
        <Plus color={colors.muted} size={iconSizes.s13} strokeWidth={2.5} />
      )}
    </View>
  );

  const tagControl = onEditThemes ? (
    <TouchableOpacity
      ref={themeButton as unknown as React.RefObject<React.ComponentRef<typeof TouchableOpacity>>}
      style={[
        styles.tagTarget,
        editingThemes && styles.actionTargetActive,
        focused === "theme" && styles.actionTargetFocused,
      ]}
      testID={`song-tag-button-${song.id}`}
      onPress={() => measureAndOpen(themeButton, onEditThemes)}
      onFocus={(event) => {
        if (isKeyboardFocusEvent(event)) setFocused("theme");
      }}
      onBlur={() => setFocused(null)}
      accessibilityRole="button"
      accessibilityLabel={themeAccessibilityLabel}
      accessibilityState={{ expanded: editingThemes }}
      aria-expanded={editingThemes}
      {...(Platform.OS === "web" ? ({ title: themeTooltip } as Record<string, unknown>) : {})}
    >
      {circleVisual}
    </TouchableOpacity>
  ) : hasTags ? (
    <View
      style={styles.tagTarget}
      accessible
      accessibilityLabel={`Temas: ${tags.join(", ")}`}
      {...(Platform.OS === "web" ? ({ title: themeTooltip } as Record<string, unknown>) : {})}
    >
      <View style={[styles.tagCircle, styles.tagCircleFilled]}>
        <Check color={colors.surface} size={iconSizes.s13} strokeWidth={3} />
      </View>
    </View>
  ) : !compactLinkActions ? (
    <View style={styles.tagTarget} />
  ) : null;

  return (
    <View
      style={[
        styles.row,
        compactLinkActions ? styles.rowCompact : styles.rowDesktop,
        !compactLinkActions && (rowHovered || menuOpen) && styles.rowHover,
        selected && styles.rowSelected,
      ]}
      testID={`song-row-${song.id}`}
      {...webHoverProps}
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
          {!compactLinkActions ? (
            <View style={styles.indexColumn}>
              {selectionMode ? (
                <View style={[styles.check, selected && styles.checkSelected]}>
                  {selected ? <Check color={colors.surface} size={iconSizes.s15} strokeWidth={2.8} /> : null}
                </View>
              ) : rowHovered && Platform.OS === "web" ? (
                <Music2 color={colors.primary} size={iconSizes.s15} />
              ) : (
                <Text style={styles.indexText}>{rowNumber ?? ""}</Text>
              )}
            </View>
          ) : selectionMode ? (
            <View style={[styles.check, selected && styles.checkSelected]}>
              {selected ? <Check color={colors.surface} size={iconSizes.s15} strokeWidth={2.8} /> : null}
            </View>
          ) : null}

          {song.artist.imageUrl ? (
            <Image
              source={{ uri: song.artist.imageUrl }}
              style={compactLinkActions ? styles.avatarMobile : styles.avatarDesktop}
            />
          ) : (
            <View style={[styles.avatarPlaceholder, !compactLinkActions && styles.avatarDesktop]}>
              <UserRound color={colors.primary} size={compactLinkActions ? iconSizes.s19 : iconSizes.s18} />
            </View>
          )}

          <View style={styles.info} testID={`song-info-${song.id}`}>
            <Text style={styles.songTitle} numberOfLines={1}>{song.title}</Text>
            <Text style={styles.meta} numberOfLines={1}>{song.artist.name}</Text>
          </View>
        </TouchableOpacity>

        {tagControl || onOpenMenu ? (
          <View
            style={[styles.actions, !compactLinkActions && styles.desktopActions]}
            testID={`song-actions-${song.id}`}
          >
            {compactLinkActions ? tagControl : tagControl ? (
              <View style={styles.desktopTagCell}>{tagControl}</View>
            ) : null}
            {onOpenMenu ? (
              <View style={!compactLinkActions ? styles.desktopMenuCell : undefined}>
                <TouchableOpacity
                  ref={menuButton as unknown as React.RefObject<React.ComponentRef<typeof TouchableOpacity>>}
                  style={[
                    styles.menuTarget,
                    !compactLinkActions && !rowHovered && !menuOpen && focused !== "menu" && styles.menuTargetResting,
                    menuOpen && styles.actionTargetActive,
                    focused === "menu" && styles.actionTargetFocused,
                  ]}
                  testID={`song-menu-button-${song.id}`}
                  onPress={() => measureAndOpen(menuButton, onOpenMenu)}
                  onFocus={(event) => {
                    if (isKeyboardFocusEvent(event)) setFocused("menu");
                  }}
                  onBlur={() => setFocused(null)}
                  accessibilityRole="button"
                  accessibilityLabel={`Mais ações de ${song.title}`}
                  accessibilityState={{ expanded: menuOpen }}
                  aria-expanded={menuOpen}
                >
                  {compactLinkActions ? (
                    <MoreVertical color={colors.muted} size={iconSizes.s19} />
                  ) : (
                    <MoreHorizontal color={rowHovered || menuOpen ? colors.ink : colors.muted} size={iconSizes.s19} />
                  )}
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    justifyContent: "center",
    backgroundColor: "transparent",
    position: "relative",
  },
  rowDesktop: {
    minHeight: 56,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.md,
  },
  rowCompact: {
    minHeight: 60,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    paddingVertical: 6,
    borderRadius: 0,
  },
  rowHover: {
    backgroundColor: colors.surface,
  },
  rowSelected: {
    backgroundColor: colors.primarySoft,
  },
  selectedRail: {
    position: "absolute",
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  headline: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  identity: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  desktopIdentity: {
    minWidth: 144,
  },
  indexColumn: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  indexText: {
    color: colors.muted,
    fontSize: fontSizes.s13,
    fontWeight: fontWeights.medium,
    fontVariant: ["tabular-nums"],
  },
  avatarMobile: {
    width: controlSizes.default,
    height: controlSizes.default,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
  avatarDesktop: {
    width: controlSizes.medium,
    height: controlSizes.medium,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
  avatarPlaceholder: {
    width: controlSizes.default,
    height: controlSizes.default,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  songTitle: {
    color: colors.ink,
    fontSize: fontSizes.s15,
    fontWeight: fontWeights.semibold,
  },
  meta: {
    color: colors.muted,
    fontSize: fontSizes.s13,
    marginTop: spacing.xxs,
  },
  actions: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
  },
  desktopActions: {
    gap: spacing.xs,
  },
  desktopTagCell: {
    width: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  desktopMenuCell: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  tagTarget: {
    width: controlSizes.default,
    height: controlSizes.default,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  tagCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  tagCircleFilled: {
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  tagCircleEmpty: {
    backgroundColor: "transparent",
    borderWidth: 1.75,
    borderColor: colors.lineStrong,
  },
  menuTarget: {
    width: controlSizes.default,
    height: controlSizes.default,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  menuTargetResting: {
    opacity: 0.55,
  },
  actionTargetActive: {
    backgroundColor: colors.primarySoft,
  },
  actionTargetFocused: {
    backgroundColor: colors.primarySoft,
    opacity: 1,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  checkSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});
