import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import {
  BookOpen,
  CheckSquare,
  Download,
  Pencil,
  Square,
  Tag,
  UserRound,
} from "lucide-react-native";
import { Song } from "../../types";
import { hasSongLinks, SongLinkButtons } from "../SongLinkButtons";
import { BottomSheet } from "../BottomSheet";
import { SongThemeLabels } from "./SongThemeLabels";
import { focusSongThemeControl, type SongThemeAnchor } from "./SongThemeMenu";
import {
  colors,
  controlSizes,
  fontSizes,
  fontWeights,
  iconSizes,
  motion,
  radii,
  radiusValues,
  shadow,
  spacing,
} from "../../theme";

type Props = {
  song: Song;
  anchor: SongThemeAnchor | null;
  selected: boolean;
  exporting?: boolean;
  onClose: () => void;
  onOpenSong: () => void;
  onEditThemes?: () => void;
  onToggleSelect: () => void;
  onEditSong?: () => void;
  onExportPdf: () => void;
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

export function SongActionMenu({
  song,
  anchor,
  selected,
  exporting = false,
  onClose,
  onOpenSong,
  onEditThemes,
  onToggleSelect,
  onEditSong,
  onExportPdf,
}: Props) {
  const { width, height } = useWindowDimensions();
  const canQueryReducedMotion = typeof AccessibilityInfo?.isReduceMotionEnabled === "function";
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(() => (canQueryReducedMotion ? null : false));
  const [closing, setClosing] = useState(false);
  const [focusedAction, setFocusedAction] = useState<string | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const firstItem = useRef<View>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const close = useCallback(() => setClosing(true), []);
  const finishClose = useCallback(() => {
    closeRef.current();
    setClosing(false);
  }, []);
  const focusFirstItem = useCallback(() => focusSongThemeControl(firstItem.current), []);

  useEffect(() => {
    let mounted = true;
    if (typeof AccessibilityInfo?.isReduceMotionEnabled === "function") {
      void AccessibilityInfo.isReduceMotionEnabled().then(
        (enabled) => {
          if (mounted) setReducedMotion(enabled);
        },
        () => {
          if (mounted) setReducedMotion(true);
        },
      );
    }
    const subscription = typeof AccessibilityInfo?.addEventListener === "function"
      ? AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion)
      : undefined;
    return () => {
      mounted = false;
      subscription?.remove?.();
    };
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
    const animation = Animated.timing(progress, {
      toValue: closing ? 0 : 1,
      duration: motion.interactionMs,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && closing) finishClose();
    });
    return () => animation.stop();
  }, [anchor, closing, finishClose, progress, reducedMotion]);

  if (reducedMotion == null) return null;

  const showLinks = hasSongLinks(song);
  const tagCount = song.tags?.length ?? 0;
  const focusProps = (key: string) => ({
    onFocus: (event: unknown) => {
      if (isKeyboardFocusEvent(event)) setFocusedAction(key);
    },
    onBlur: () => setFocusedAction(null),
  });

  const body = (
    <View testID="song-action-menu">
      <View style={styles.songHeader}>
        {song.artist.imageUrl ? (
          <Image source={{ uri: song.artist.imageUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <UserRound color={colors.primary} size={iconSizes.s20} />
          </View>
        )}
        <View style={styles.songIdentity}>
          <Text style={styles.songTitle} numberOfLines={2}>{song.title}</Text>
          <Text style={styles.songArtist} numberOfLines={1}>{song.artist.name}</Text>
          <View style={styles.metaPills}>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{`Tom ${song.originalKey}`}</Text>
            </View>
            {song.bpm ? (
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>{`${song.bpm} BPM`}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.tagsSection}>
        {tagCount > 0 ? (
          <SongThemeLabels tags={song.tags} />
        ) : (
          <Text style={styles.noTagsText}>Sem temas</Text>
        )}
      </View>

      <View style={styles.actionsList} accessibilityRole="menu" accessibilityLabel={`Ações de ${song.title}`}>
        <TouchableOpacity
          ref={firstItem as unknown as React.RefObject<React.ComponentRef<typeof TouchableOpacity>>}
          style={[styles.actionRow, focusedAction === "open" && styles.actionFocused]}
          onPress={onOpenSong}
          accessibilityRole="button"
          accessibilityLabel="Abrir cifra"
          {...focusProps("open")}
        >
          <BookOpen color={colors.primary} size={iconSizes.s17} />
          <Text style={styles.actionLabel}>Abrir cifra</Text>
        </TouchableOpacity>

        {onEditThemes ? (
          <TouchableOpacity
            style={[styles.actionRow, focusedAction === "themes" && styles.actionFocused]}
            onPress={onEditThemes}
            accessibilityRole="button"
            accessibilityLabel="Editar temas"
            {...focusProps("themes")}
          >
            <Tag color={colors.primary} size={iconSizes.s17} />
            <Text style={styles.actionLabel}>Editar temas</Text>
            <Text style={styles.actionMeta}>{tagCount}</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.actionRow, focusedAction === "select" && styles.actionFocused]}
          onPress={onToggleSelect}
          accessibilityRole="button"
          accessibilityLabel={selected ? "Remover da seleção" : "Selecionar música"}
          {...focusProps("select")}
        >
          {selected ? (
            <CheckSquare color={colors.primary} size={iconSizes.s17} />
          ) : (
            <Square color={colors.primary} size={iconSizes.s17} />
          )}
          <Text style={styles.actionLabel}>{selected ? "Remover da seleção" : "Selecionar música"}</Text>
        </TouchableOpacity>

        {showLinks ? (
          <View style={styles.linksSection}>
            <Text style={styles.sectionEyebrow}>LINKS DA MÚSICA</Text>
            <SongLinkButtons links={song} variant="sheet" />
          </View>
        ) : null}

        <View style={styles.divider} />

        {onEditSong ? (
          <TouchableOpacity
            style={[styles.actionRow, focusedAction === "edit" && styles.actionFocused]}
            onPress={onEditSong}
            accessibilityRole="button"
            accessibilityLabel="Editar música"
            {...focusProps("edit")}
          >
            <Pencil color={colors.primary} size={iconSizes.s17} />
            <Text style={styles.actionLabel}>Editar música</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.actionRow, exporting && styles.actionDisabled, focusedAction === "export" && styles.actionFocused]}
          onPress={onExportPdf}
          disabled={exporting}
          accessibilityRole="button"
          accessibilityLabel="Exportar PDF da cifra"
          accessibilityState={{ disabled: exporting }}
          {...focusProps("export")}
        >
          <Download color={colors.primary} size={iconSizes.s17} />
          <Text style={styles.actionLabel}>{exporting ? "Exportando PDF…" : "Exportar PDF da cifra"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!anchor) {
    return (
      <BottomSheet
        isOpen={!closing}
        title="Ações da música"
        onClose={close}
        onClosed={finishClose}
        onShow={focusFirstItem}
        reduceMotion={reducedMotion}
        openDuration={320}
        closeDuration={220}
        sheetStyle={styles.sheet}
      >
        {body}
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
        <Pressable testID="song-action-backdrop" style={StyleSheet.absoluteFill} onPress={close} accessible={false} />
        <Animated.View
          style={[
            styles.popover,
            {
              width: menuWidth,
              left,
              maxHeight: Math.max(120, opensBelow ? below : above),
              opacity: progress,
              transform: [{
                translateY: typeof progress.interpolate === "function"
                  ? progress.interpolate({ inputRange: [0, 1], outputRange: [6, 0] })
                  : 0,
              }],
            },
            placement,
          ]}
          accessibilityViewIsModal
          accessibilityLabel={`Ações de ${song.title}`}
          testID="song-action-popover"
        >
          <ScrollView style={styles.popoverScroll} keyboardShouldPersistTaps="handled">
            {body}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderRadius: radiusValues.r8,
    borderTopLeftRadius: radiusValues.r12,
    borderTopRightRadius: radiusValues.r12,
  },
  popover: {
    position: "absolute",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    overflow: "hidden",
    ...shadow,
  },
  popoverScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  songHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  avatar: {
    width: controlSizes.default,
    height: controlSizes.default,
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
  songIdentity: {
    flex: 1,
    minWidth: 0,
  },
  songTitle: {
    color: colors.ink,
    fontSize: fontSizes.s15,
    fontWeight: fontWeights.bold,
  },
  songArtist: {
    color: colors.muted,
    fontSize: fontSizes.s12,
    marginTop: spacing.xxs,
  },
  metaPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  metaPill: {
    height: 22,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  metaPillText: {
    color: colors.ink,
    fontSize: fontSizes.s11,
    fontWeight: fontWeights.bold,
  },
  tagsSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  noTagsText: {
    color: colors.muted,
    fontSize: fontSizes.s12,
  },
  actionsList: {
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  actionRow: {
    minHeight: controlSizes.default,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  actionFocused: {
    backgroundColor: colors.primarySoft,
  },
  actionDisabled: {
    opacity: 0.55,
  },
  actionLabel: {
    flex: 1,
    color: colors.ink,
    fontSize: fontSizes.s14,
    fontWeight: fontWeights.semibold,
  },
  actionMeta: {
    color: colors.muted,
    fontSize: fontSizes.s12,
    fontWeight: fontWeights.bold,
  },
  linksSection: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.xs,
  },
  sectionEyebrow: {
    color: colors.muted,
    fontSize: fontSizes.s11,
    fontWeight: fontWeights.extrabold,
    letterSpacing: 0.7,
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: spacing.xs,
    marginHorizontal: spacing.sm,
  },
});
