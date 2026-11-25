import { uiPatterns } from "../../../src/components/ui/patterns";
import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  LayoutChangeEvent,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowUpDown, Check, MicVocal, Plus, Search, X } from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ArtistPicker } from "../../../src/components/ArtistPicker";
import { SongSelectionBar } from "../../../src/components/songs/SongSelectionBar";
import { DOCK_HEIGHT } from "../../../src/components/StagingDockSurface";
import { useDockClearance, useDockContentClearance } from "../../../src/navigation/stagingDockClearance";
import { SongBulkThemeEditor } from "../../../src/components/songs/SongBulkThemeEditor";
const LazySongDataTransferPanel = lazy(() =>
  import("../../../src/components/songs/SongDataTransferPanel").then((mod) => ({
    default: mod.SongDataTransferPanel,
  }))
);
import { SongActionMenu } from "../../../src/components/songs/SongActionMenu";
import { SongListRow } from "../../../src/components/songs/SongListRow";
import { SongThemeBar } from "../../../src/components/songs/SongThemeBar";
import { SongQuickThemeEditor } from "../../../src/components/songs/SongQuickThemeEditor";
import type { SongThemeAnchor } from "../../../src/components/songs/SongThemeMenu";
import { SongSelectionSummary } from "../../../src/components/songs/SongSelectionSummary";
import {
  AppInput,
  Button,
  Chip,
  EmptyState,
  ErrorBanner,
  FeedbackToast,
  FeedbackTone,
  FilterButton,
  FilterPanel,
  FilterSection,
  LoadingState,
} from "../../../src/components/ui";
import { GradualBlur } from "../../../src/components/ui/GradualBlur";
import { useReducedMotion } from "../../../src/hooks/useReducedMotion";
import { useResponsiveLayout } from "../../../src/hooks/useResponsiveLayout";
import { useAuthStore } from "../../../src/store/authStore";
import { nav } from "../../../src/navigation/routes";
import { useMusicStore } from "../../../src/store/musicStore";
import { musicService, SongListParams, SongTagCounts, SongTagOption, SongThemeBatchResult, SongThemeChange, SongThemeOperation, SongsUnavailableClientError } from "../../../src/services/musicService";
import { Artist, MUSICAL_KEYS, MusicalKey, Song, User } from "../../../src/types";
import { canManageMusic } from "../../../src/utils/musicPermissions";
import {
  MAX_SONG_SELECTION,
  reconcileSongSelection,
  SongSelectionSnapshot,
  toggleSongPageSelection,
  toggleSongSelection,
} from "../../../src/utils/songSelection";
import {
  colors,
  controlSizes,
  fontSizes,
  fontWeights,
  iconSizes,
  lineHeights,
  motion,
  overlays,
  radii,
  screen,
  spacing,
} from "../../../src/theme";

const TEXT = {
  songSearch: "Música, artista ou #tema",
  searchSongs: "Buscar músicas",
  songs: "Músicas",
  newSong: "Nova música",
  retryLoadSongs: "Tentar carregar músicas novamente",
  loadingSongs: "Carregando músicas...",
  noSongsFound: "Nenhuma música encontrada",
  registerSongs: "Cadastre músicas para montar repertórios e escalas.",
  exportError: "Não foi possível exportar as cifras.",
  nextPage: "Próxima",
} as const;

type SongFilterState = {
  artist: Artist | null;
  originalKey?: MusicalKey;
  tags: string[];
  untagged: boolean;
};

type Feedback = { message: string; tone: FeedbackTone };

const emptyFilters = (): SongFilterState => ({ artist: null, tags: [], untagged: false });

function toQueryFilters(filters: SongFilterState): SongListParams {
  return {
    ...(filters.artist ? { artistId: filters.artist.id } : {}),
    ...(filters.originalKey ? { originalKey: filters.originalKey } : {}),
    ...(filters.tags.length ? { tags: filters.tags } : {}),
    ...(filters.untagged ? { untagged: true } : {}),
  };
}

function sameScope(left: SongFilterState, right: SongFilterState): boolean {
  return left.artist?.id === right.artist?.id && left.originalKey === right.originalKey;
}

function totalLabel(total: number): string {
  return `${total} ${total === 1 ? "música encontrada" : "músicas encontradas"}`;
}

function singleQueryParam(value?: string | string[]): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function arrayQueryParam(value?: string | string[]): string[] {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  return raw.flatMap((item) => item.split(",")).map((item) => item.trim()).filter(Boolean);
}

function positiveIntParam(value?: string | string[], fallback = 1): number {
  const parsed = Number.parseInt(singleQueryParam(value), 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
}

function booleanQueryParam(value?: string | string[]): boolean {
  const raw = singleQueryParam(value).trim().toLowerCase();
  return raw === "1" || raw === "true";
}

export default function SongsScreen() {
  const user = useAuthStore((state) => state.user);
  return <SongsCatalogue key={JSON.stringify([user?.tenantId, user?.id])} user={user} />;
}

function SongsCatalogue({ user }: { user: User | null }) {
  const dockClearance = useDockClearance();
  const withDockClearance = useDockContentClearance();
  const bottomBlurHeight = dockClearance > 0 ? Math.max(0, dockClearance - Math.round(DOCK_HEIGHT / 3)) : 0;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const routeParams = useLocalSearchParams<{
    q?: string | string[];
    page?: string | string[];
    theme?: string | string[];
    withoutTheme?: string | string[];
  }>();
  const { screenWidth } = useResponsiveLayout();
  const { songs, tagCounts, pagination, loading, refreshing, error, listInvalidationVersion, themeVersion, loadSongs, primeSong, applySongThemes } = useMusicStore();
  const [search, setSearch] = useState(() => singleQueryParam(routeParams.q));
  const [page, setPage] = useState(() => positiveIntParam(routeParams.page, 1));
  const pageNumbers = Array.from(new Set([
    1,
    ...Array.from({ length: Math.min(5, pagination.totalPages) }, (_, index) =>
      Math.max(1, Math.min(page - 2, pagination.totalPages - 4)) + index),
    pagination.totalPages,
  ])).filter((value) => value > 0).sort((a, b) => a - b);
  const pageSlots = pageNumbers.flatMap<string | number>((number, index) =>
    index > 0 && number - pageNumbers[index - 1] > 1 ? [`gap-${number}`, number] : [number]);
  const [pageTrackWidth, setPageTrackWidth] = useState(0);
  const pageIndicatorX = useRef(new Animated.Value(0)).current;
  const pageIndicatorInitialized = useRef(false);
  const reducedMotion = useReducedMotion();
  const activePageSlot = pageSlots.indexOf(page);
  const pageSlotCount = pageSlots.length;

  useEffect(() => {
    if (pageTrackWidth <= 0 || activePageSlot < 0) return;
    const slotWidth = pageTrackWidth / pageSlotCount;
    const target = slotWidth * activePageSlot + (slotWidth - 24) / 2;
    if (!pageIndicatorInitialized.current || reducedMotion) {
      pageIndicatorX.setValue(target);
      pageIndicatorInitialized.current = true;
      return;
    }
    const animation = Animated.timing(pageIndicatorX, {
      toValue: target,
      duration: motion.navigationSelectionMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [activePageSlot, pageSlotCount, pageTrackWidth, pageIndicatorX, reducedMotion]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSongs, setSelectedSongs] = useState<Map<string, SongSelectionSnapshot>>(() => new Map());
  const [exporting, setExporting] = useState(false);
  const [contentWidth, setContentWidth] = useState(0);
  const [songMenu, setSongMenu] = useState<{ song: Song; anchor: SongThemeAnchor | null } | null>(null);
  const [themeEditor, setThemeEditor] = useState<{ song: Song; anchor: SongThemeAnchor | null } | null>(null);
  const [themePreview, setThemePreview] = useState<SongThemeChange | null>(null);
  const [bulkEditor, setBulkEditor] = useState<{
    songIds: string[];
    operation: SongThemeOperation;
    anchor: SongThemeAnchor | null;
  } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showDataTransfer, setShowDataTransfer] = useState(false);
  const [filters, setFilters] = useState<SongFilterState>(() => ({
    artist: null,
    tags: arrayQueryParam(routeParams.theme),
    untagged: booleanQueryParam(routeParams.withoutTheme),
  }));
  const [draftFilters, setDraftFilters] = useState<SongFilterState>(filters);
  const [themeCounts, setThemeCounts] = useState<SongTagCounts | null>(null);
  const [themeError, setThemeError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const routerRef = useRef(router);
  routerRef.current = router;
  const searchRef = useRef(search);
  const pageRef = useRef(page);
  const filtersRef = useRef<SongListParams>(toQueryFilters(filters));
  const exportingRef = useRef(false);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didMountSearchRef = useRef(false);
  const countsRequest = useRef<AbortController | null>(null);
  const knownTags = useRef(new Map<string, SongTagOption>());
  const handledInvalidationRef = useRef(listInvalidationVersion);
  const handledThemeVersionRef = useRef(themeVersion);

  const syncUrlParams = useCallback((
    nextSearch: string,
    nextPage: number,
    nextTags: string[],
    nextUntagged: boolean
  ) => {
    try {
      routerRef.current.setParams({
        q: nextSearch.trim() ? nextSearch : undefined,
        page: nextPage > 1 ? String(nextPage) : undefined,
        theme: nextTags.length ? nextTags.join(",") : undefined,
        withoutTheme: nextUntagged ? "1" : undefined,
      } as Record<string, string | undefined>);
    } catch {
      // Ignore if router context is unavailable in unit tests.
    }
  }, []);

  useEffect(() => { searchRef.current = search; }, [search]);

  useEffect(() => () => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
  }, []);

  const showFeedback = useCallback((message: string, tone: FeedbackTone = "success") => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedback({ message, tone });
    AccessibilityInfo?.announceForAccessibility?.(message);
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 4200);
  }, []);

  const loadThemeCounts = useCallback(() => {
    countsRequest.current?.abort();
    const request = new AbortController();
    countsRequest.current = request;
    setThemeError(null);
    void musicService.listSongTagCounts(searchRef.current, filtersRef.current, request.signal)
      .then((result) => {
        if (!request.signal.aborted) {
          setThemeCounts(result);
        }
      })
      .catch(() => {
        if (!request.signal.aborted) setThemeError("Não foi possível carregar os temas.");
      });
  }, []);

  useEffect(() => {
    if (tagCounts) {
      setThemeCounts(tagCounts);
    }
  }, [tagCounts]);

  useEffect(() => {
    themeCounts?.items.forEach((tag) => knownTags.current.set(tag.id, tag));
  }, [themeCounts]);

  const loadVisibleSongs = useCallback((forceRefresh = false, includeTagCounts = false) => {
    const hasCachedSongs = useMusicStore.getState().songs.length > 0;
    void loadSongs(searchRef.current, pageRef.current, {
      refresh: forceRefresh || hasCachedSongs,
      filters: filtersRef.current,
      ...(includeTagCounts ? { includeTagCounts: true } : {}),
    }).then(() => {
      if (!includeTagCounts) return;
      const latestState = useMusicStore.getState();
      if (!latestState.tagCounts && !latestState.error) {
        loadThemeCounts();
      }
    });
  }, [loadSongs, loadThemeCounts]);

  const refreshCatalogue = useCallback((forceRefresh = false) => {
    loadVisibleSongs(forceRefresh, true);
  }, [loadVisibleSongs]);

  useFocusEffect(useCallback(() => {
    refreshCatalogue();
    return () => countsRequest.current?.abort();
  }, [refreshCatalogue]));

  useEffect(() => {
    if (!didMountSearchRef.current) {
      didMountSearchRef.current = true;
      return undefined;
    }

    const timer = setTimeout(() => {
      searchRef.current = search;
      pageRef.current = 1;
      setPage(1);
      syncUrlParams(search, 1, filtersRef.current.tags ?? [], Boolean(filtersRef.current.untagged));
      refreshCatalogue();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, refreshCatalogue, syncUrlParams]);

  useEffect(() => {
    if (pageRef.current === page) return;
    pageRef.current = page;
    syncUrlParams(searchRef.current, page, filtersRef.current.tags ?? [], Boolean(filtersRef.current.untagged));
    loadVisibleSongs();
  }, [page, loadVisibleSongs, syncUrlParams]);

  useEffect(() => {
    if (handledInvalidationRef.current === listInvalidationVersion) return;
    handledInvalidationRef.current = listInvalidationVersion;
    refreshCatalogue(true);
  }, [listInvalidationVersion, refreshCatalogue]);

  useEffect(() => {
    if (handledThemeVersionRef.current === themeVersion) return;
    handledThemeVersionRef.current = themeVersion;
    loadThemeCounts();
  }, [themeVersion, loadThemeCounts]);

  useEffect(() => {
    if (!selectedSongs.size || !songs.length) return;
    setSelectedSongs((current) => reconcileSongSelection(current, songs));
  }, [songs, selectedSongs.size]);

  useEffect(() => {
    const last = Math.max(1, pagination.totalPages);
    if (!loading && !refreshing && !error && page === pagination.page && page > last) setPage(last);
  }, [loading, refreshing, error, page, pagination.page, pagination.totalPages]);

  const allPageSelected = songs.length > 0 && songs.every((song) => selectedSongs.has(song.id));
  const canEditThemes = canManageMusic(user, "song:edit");
  const activeFilters = Boolean(filters.artist || filters.originalKey);
  const canApplyFilters = !sameScope(filters, draftFilters);
  const hasDraftFilters = Boolean(draftFilters.artist || draftFilters.originalKey);
  const effectiveWidth = contentWidth || screenWidth;
  const compactLinkActions = effectiveWidth < 600;
  const ultraCompactHeader = screenWidth < 375;
  const baseBottomPadding = compactLinkActions ? spacing.sm : screen.contentBottomPadding + spacing.xl;

  const toggleSong = useCallback((song: Song) => {
    setSelectedSongs((current) => {
      const result = toggleSongSelection(current, song);
      if (result.limitReached) {
        showFeedback(`Você pode selecionar até ${MAX_SONG_SELECTION} músicas.`, "warning");
      }
      return result.selection;
    });
  }, [showFeedback]);

  const togglePageSelection = useCallback(() => {
    if (!songs.length) return;
    setSelectedSongs((current) => {
      const result = toggleSongPageSelection(current, songs, MAX_SONG_SELECTION);
      if (result.added < result.candidates) {
        showFeedback(
          `${result.added} de ${result.candidates} músicas adicionadas. O limite é de ${MAX_SONG_SELECTION} músicas.`,
          "warning"
        );
      }
      return result.selection;
    });
  }, [showFeedback, songs]);

  const cancelSelection = useCallback(() => {
    setSelectedSongs(new Map());
    setIsSelectionMode(false);
    setBulkEditor(null);
  }, []);

  const exportSelected = useCallback(async () => {
    if (!selectedSongs.size || exportingRef.current) return;
    exportingRef.current = true;
    setExporting(true);
    try {
      await musicService.exportSongs(
        Array.from(selectedSongs.keys()),
        `Cifras - ${new Date().toISOString().slice(0, 10)}.pdf`
      );
      showFeedback("Arquivo gerado com sucesso.");
    } catch (reason) {
      if (reason instanceof SongsUnavailableClientError) {
        const unavailable = new Set(reason.songIds);
        setSelectedSongs((current) => {
          const next = new Map(current);
          unavailable.forEach((id) => next.delete(id));
          return next;
        });
        const count = reason.songIds.length;
        showFeedback(
          `${count || "Algumas"} ${count === 1 ? "música foi removida" : "músicas foram removidas"} da seleção por não estarem mais disponíveis.`,
          "warning"
        );
      } else {
        showFeedback(reason instanceof Error ? reason.message : TEXT.exportError, "error");
      }
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  }, [selectedSongs, showFeedback]);

  const exportSingleSong = useCallback(async (song: Song) => {
    if (exportingRef.current) return;
    exportingRef.current = true;
    setExporting(true);
    try {
      const safeTitle = song.title.replace(/[\\/:*?"<>|]/g, "").trim() || "Cifra";
      await musicService.exportSongs([song.id], `${safeTitle}.pdf`);
      showFeedback("Arquivo gerado com sucesso.");
    } catch (reason) {
      showFeedback(reason instanceof Error ? reason.message : TEXT.exportError, "error");
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  }, [showFeedback]);

  const openFilters = useCallback(() => {
    setDraftFilters(filters);
    setShowFilters(true);
  }, [filters]);

  const commitFilters = useCallback((next: SongFilterState) => {
    const previous = filtersRef.current;
    const queryFilters = toQueryFilters(next);
    filtersRef.current = queryFilters;
    setFilters(next);
    setDraftFilters(next);
    setShowFilters(false);
    pageRef.current = 1;
    setPage(1);
    const includeTagCounts = previous.artistId !== queryFilters.artistId || previous.originalKey !== queryFilters.originalKey;
    syncUrlParams(searchRef.current, 1, next.tags, next.untagged);
    loadVisibleSongs(false, includeTagCounts);
  }, [loadVisibleSongs, syncUrlParams]);

  const applyFilters = useCallback(() => commitFilters(draftFilters), [commitFilters, draftFilters]);
  const clearFilters = useCallback(() => commitFilters({ ...filters, artist: null, originalKey: undefined }), [commitFilters, filters]);
  const toggleTheme = (name: string | null) => {
    if (name === null) {
      commitFilters({ ...filters, untagged: !filters.untagged });
      return;
    }
    const tags = filters.tags.includes(name)
      ? filters.tags.filter((tag) => tag !== name)
      : [...filters.tags, name];
    commitFilters({ ...filters, tags });
  };

  const handleContentLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    setContentWidth((current) => current === nextWidth ? current : nextWidth);
  }, []);

  const openBulkEditor = (operation: SongThemeOperation, anchor: SongThemeAnchor | null) => {
    setBulkEditor({ songIds: Array.from(selectedSongs.keys()), operation, anchor });
  };

  const saveBulkThemes = ({ items, updated }: SongThemeBatchResult) => {
    applySongThemes(items);
    setSelectedSongs((current) => {
      const next = new Map(current);
      items.forEach(({ id, tags }) => {
        const song = next.get(id);
        if (song) next.set(id, { ...song, tags: [...tags] });
      });
      return next;
    });
    setBulkEditor(null);
    showFeedback(updated
      ? `Temas atualizados em ${updated} ${updated === 1 ? "música" : "músicas"}.`
      : "A seleção já estava atualizada.");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      {feedback ? <FeedbackToast message={feedback.message} tone={feedback.tone} /> : null}

      <FilterPanel
        visible={showFilters}
        title="Filtrar músicas"
        canApply={canApplyFilters}
        onApply={applyFilters}
        onClose={() => setShowFilters(false)}
        onClear={activeFilters || hasDraftFilters ? clearFilters : undefined}
      >
        <ArtistPicker
          selected={draftFilters.artist}
          onSelect={(artist) => setDraftFilters((current) => ({ ...current, artist }))}
          canCreate={false}
          label="Artista"
          placeholder="Buscar artista"
          testID="song-filter-artist-input"
        />
        <FilterSection title="Tom original">
          {MUSICAL_KEYS.map((key) => (
            <Chip
              key={key}
              label={key}
              active={draftFilters.originalKey === key}
              onPress={() => setDraftFilters((current) => ({
                ...current,
                originalKey: current.originalKey === key ? undefined : key,
              }))}
              accessibilityLabel={`${draftFilters.originalKey === key ? "Remover" : "Filtrar por"} tom ${key}`}
              accessibilityState={{ selected: draftFilters.originalKey === key }}
            />
          ))}
        </FilterSection>
      </FilterPanel>

      {showDataTransfer ? (
        <Suspense fallback={null}>
          <LazySongDataTransferPanel
            visible={showDataTransfer}
            canImport={canManageMusic(user, "song:import")}
            canExport={canManageMusic(user, "song:export")}
            onClose={() => setShowDataTransfer(false)}
            onImported={(message) => {
              showFeedback(message);
              refreshCatalogue(true);
            }}
          />
        </Suspense>
      ) : null}

      <ScrollView
        style={styles.scroller}
        testID="song-catalog-scroll"
        contentContainerStyle={isSelectionMode
          ? [styles.page, compactLinkActions && styles.pageCompact, { paddingBottom: baseBottomPadding + Math.max(spacing.sm, insets.bottom) }]
          : withDockClearance([styles.page, compactLinkActions && styles.pageCompact])}
        keyboardShouldPersistTaps="handled"
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => refreshCatalogue(true)}
            colors={[colors.primary]}
          />
        )}
      >
        <View style={[styles.contentShell, compactLinkActions && styles.contentShellCompact]}>
          <View style={styles.measuredContent} onLayout={handleContentLayout} testID="songs-content-width">
            <View style={[styles.header, compactLinkActions && styles.headerCompact]} testID="songs-header">
              <View style={styles.headerCopy}>
                <Text style={[styles.title, compactLinkActions && styles.titleCompact]} numberOfLines={1}>{TEXT.songs}</Text>
                <Text style={[styles.subtitle, compactLinkActions && styles.subtitleCompact]} numberOfLines={1}>Cifras da sua igreja</Text>
              </View>
              <View style={[styles.actions, compactLinkActions && styles.actionsCompact]} testID="songs-header-actions">
                {canManageMusic(user, "song:import") || canManageMusic(user, "song:export") ? (
                  compactLinkActions ? (
                    <TouchableOpacity
                      style={[styles.iconButton, styles.transferIconButton]}
                      onPress={() => setShowDataTransfer(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Importar ou exportar músicas"
                      testID="songs-transfer-button"
                      hitSlop={4}
                    >
                      <ArrowUpDown color={colors.primary} size={iconSizes.s16} />
                    </TouchableOpacity>
                  ) : (
                    <Button
                      title="Importar/exportar"
                      variant="secondary"
                      size="sm"
                      onPress={() => setShowDataTransfer(true)}
                      accessibilityLabel="Importar ou exportar músicas"
                      testID="songs-transfer-button"
                      style={styles.compactHeaderButton}
                      textStyle={styles.headerButtonText}
                      hitSlop={4}
                    />
                  )
                ) : null}
                {canManageMusic(user, "song:edit") || canManageMusic(user, "song:create") ? (
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => router.push(nav.artists)}
                    accessibilityRole="button"
                    accessibilityLabel="Gerenciar artistas"
                    testID="songs-artists-button"
                    hitSlop={4}
                  >
                    <MicVocal color={colors.primary} size={iconSizes.s16} />
                  </TouchableOpacity>
                ) : null}
                {canManageMusic(user, "song:create") ? (
                  <Button
                    title={ultraCompactHeader ? "Nova" : TEXT.newSong}
                    size="sm"
                    icon={<Plus color={colors.surface} size={iconSizes.s16} />}
                    onPress={() => router.push(nav.songNew)}
                    accessibilityLabel={TEXT.newSong}
                    testID="songs-new-button"
                    style={[styles.compactHeaderButton, compactLinkActions && styles.compactNewSongButton]}
                    textStyle={styles.headerButtonText}
                    hitSlop={4}
                  />
                ) : null}
              </View>
            </View>

            <View style={styles.searchRow} testID="songs-search-row">
              <AppInput
                value={search}
                onChangeText={setSearch}
                placeholder={TEXT.songSearch}
                accessibilityLabel={TEXT.searchSongs}
                testID="song-search-input"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                icon={<Search color={colors.muted} size={iconSizes.s19} />}
                endAdornment={search ? (
                  <TouchableOpacity
                    style={styles.clearSearchButton}
                    onPress={() => setSearch("")}
                    accessibilityRole="button"
                    accessibilityLabel="Limpar pesquisa de músicas"
                    hitSlop={8}
                  >
                    <X color={colors.muted} size={iconSizes.s18} strokeWidth={2.4} />
                  </TouchableOpacity>
                ) : null}
                containerStyle={styles.searchInput}
              />
              <FilterButton
                active={activeFilters}
                onPress={openFilters}
                accessibilityLabel="Abrir filtros de músicas"
                style={styles.filterButton}
              />
            </View>

            <ErrorBanner
              message={error ?? themeError}
              style={styles.error}
              action={error || themeError ? (
                <Button
                  title="Tentar novamente"
                  variant="secondary"
                  size="sm"
                  style={styles.retryButton}
                  onPress={() => refreshCatalogue(true)}
                  accessibilityLabel={TEXT.retryLoadSongs}
                />
              ) : null}
            />

            <SongThemeBar
              counts={themeCounts}
              selected={filters.tags}
              untagged={filters.untagged}
              compact={compactLinkActions}
              refreshTrigger={themeVersion}
              onToggle={toggleTheme}
              action={!isSelectionMode ? (
                <TouchableOpacity
                  onPress={() => setIsSelectionMode(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Selecionar músicas"
                  hitSlop={6}
                >
                  <Text style={styles.selectionEntryText}>Selecionar músicas</Text>
                </TouchableOpacity>
              ) : null}
            />

            <View style={styles.singleColumn}>
              <View style={[styles.mainColumn, compactLinkActions && styles.mainColumnCompact]}>
                <View style={[styles.listContainer, compactLinkActions && styles.listContainerCompact]} testID="songs-list-container">
                  <View style={[styles.listHeader, compactLinkActions && styles.listHeaderCompact]}>
                    <Text style={styles.listCount} accessibilityLiveRegion="polite">{totalLabel(pagination.total)}</Text>
                    {isSelectionMode ? (
                      <SongSelectionSummary
                        selectedCount={selectedSongs.size}
                        pageEmpty={!songs.length}
                        allPageSelected={allPageSelected}
                        onTogglePage={togglePageSelection}
                        onClear={() => setSelectedSongs(new Map())}
                      />
                    ) : null}
                  </View>

                  {(loading || refreshing) && !songs.length ? (
                    <LoadingState centered={false} message={TEXT.loadingSongs} style={styles.inlineLoading} />
                  ) : !songs.length ? (
                    <EmptyState
                      title={TEXT.noSongsFound}
                      description={search.trim() || activeFilters || filters.tags.length || filters.untagged ? "Tente ajustar a busca ou limpar os filtros." : TEXT.registerSongs}
                      style={[styles.emptyState, compactLinkActions && styles.emptyStateCompact]}
                    />
                  ) : (
                    <>
                      {!compactLinkActions ? (
                        <View style={styles.tableHeader} testID="songs-table-header">
                          <View style={styles.tableHeaderIndex}>
                            {isSelectionMode ? (
                              <TouchableOpacity
                                onPress={togglePageSelection}
                                accessibilityRole="checkbox"
                                accessibilityLabel={allPageSelected ? "Desmarcar músicas da página" : "Selecionar músicas da página"}
                                accessibilityState={{ checked: allPageSelected }}
                                style={[styles.headerCheck, allPageSelected && styles.headerCheckSelected]}
                              >
                                {allPageSelected ? <Check color={colors.surface} size={iconSizes.s13} strokeWidth={3} /> : null}
                              </TouchableOpacity>
                            ) : (
                              <Text style={styles.tableHeaderText}>#</Text>
                            )}
                          </View>
                          <Text style={[styles.tableHeaderText, styles.tableHeaderTitle]}>TÍTULO</Text>
                          <Text style={[styles.tableHeaderText, styles.tableHeaderTags]}>ETIQUETAS</Text>
                          <View style={styles.tableHeaderMenu} />
                        </View>
                      ) : null}
                      <View style={[styles.listRows, compactLinkActions && styles.listRowsCompact]}>
                        {songs.map((song, index) => (
                          <SongListRow
                            key={song.id}
                            song={themePreview?.id === song.id ? { ...song, tags: themePreview.tags } : song}
                            rowNumber={(pagination.page - 1) * (pagination.limit || 20) + index + 1}
                            selectionMode={isSelectionMode}
                            selected={selectedSongs.has(song.id)}
                            isLast={index === songs.length - 1}
                            compactLinkActions={compactLinkActions}
                            editingThemes={themeEditor?.song.id === song.id}
                            menuOpen={songMenu?.song.id === song.id}
                            onEditThemes={canEditThemes ? (anchor) => {
                              if (!themePreview) {
                                setSongMenu(null);
                                setThemeEditor({ song, anchor });
                              }
                            } : undefined}
                            onOpenMenu={(anchor) => {
                              setThemeEditor(null);
                              setSongMenu({ song, anchor });
                            }}
                            onPress={() => {
                              if (isSelectionMode) {
                                toggleSong(song);
                                return;
                              }
                              primeSong(song);
                              router.push(nav.songDetail(song.id));
                            }}
                          />
                        ))}
                      </View>
                    </>
                  )}
                </View>

                {pagination.totalPages > 1 ? (
                  <View style={[styles.pagination, compactLinkActions && styles.paginationCompact]} testID="songs-pagination">
                    <TouchableOpacity style={styles.pageNavigation} accessibilityRole="button" accessibilityLabel="Página anterior" disabled={page <= 1} onPress={() => setPage(page - 1)}>
                      <Text style={[styles.pageArrow, page <= 1 && styles.disabledText]}>←</Text>
                      {contentWidth >= 600 ? <Text style={[styles.link, page <= 1 && styles.disabledText]}>Anterior</Text> : null}
                    </TouchableOpacity>
                    <View style={styles.pageNumbers} onLayout={(event) => setPageTrackWidth(event.nativeEvent.layout.width)}>
                      {pageSlots.map((slot) => typeof slot === "string" ? (
                        <View key={slot} style={styles.pageSlot}><Text style={styles.pageText}>…</Text></View>
                      ) : (
                        <TouchableOpacity
                          key={slot}
                          style={styles.pageSlot}
                          accessibilityRole="button"
                          accessibilityLabel={`Página ${slot}`}
                          accessibilityState={{ selected: slot === page }}
                          onPress={() => setPage(slot)}
                        >
                          <Text style={[styles.pageNumberText, slot === page && styles.pageNumberActiveText]}>{slot}</Text>
                        </TouchableOpacity>
                      ))}
                      {pageTrackWidth > 0 ? <Animated.View
                        pointerEvents="none"
                        style={[styles.pageIndicator, { transform: [{ translateX: pageIndicatorX }] }]}
                      /> : null}
                    </View>
                    <TouchableOpacity style={styles.pageNavigation} accessibilityRole="button" accessibilityLabel="Próxima página" disabled={page >= pagination.totalPages} onPress={() => setPage(page + 1)}>
                      {contentWidth >= 600 ? <Text style={[styles.link, page >= pagination.totalPages && styles.disabledText]}>{TEXT.nextPage}</Text> : null}
                      <Text style={[styles.pageArrow, page >= pagination.totalPages && styles.disabledText]}>→</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>

            </View>
          </View>
        </View>
      </ScrollView>

      {!isSelectionMode && bottomBlurHeight > 0 ? (
        <GradualBlur
          position="bottom"
          target="parent"
          height={bottomBlurHeight}
          strength={1.1}
          layers={6}
          curve="bezier"
          exponential
          tint={overlays.bottomEdgeFade}
          zIndex={5}
          testID="songs-bottom-blur"
        />
      ) : null}

      {isSelectionMode ? (
        <SongSelectionBar
          count={selectedSongs.size}
          compact={compactLinkActions}
          canEditThemes={canEditThemes}
          savingTheme={Boolean(themePreview)}
          exporting={exporting}
          onThemeAction={openBulkEditor}
          onExport={() => void exportSelected()}
          onCancel={cancelSelection}
        />
      ) : null}

      {canEditThemes && bulkEditor ? (
        <SongBulkThemeEditor
          {...bulkEditor}
          knownTags={Array.from(knownTags.current.values())}
          selectedSongs={Array.from(selectedSongs.values()).filter((song) => bulkEditor.songIds.includes(song.id))}
          onSaved={saveBulkThemes}
          onClose={() => setBulkEditor(null)}
        />
      ) : null}

      {canEditThemes && themeEditor ? (
        <SongQuickThemeEditor
          key={themeEditor.song.id}
          song={themeEditor.song}
          anchor={themeEditor.anchor}
          knownNames={themeCounts?.items.map(({ name }) => name) ?? []}
          onClose={() => setThemeEditor(null)}
          onPreview={setThemePreview}
          onSaved={(change) => applySongThemes([change])}
          onError={(message) => showFeedback(message, "error")}
        />
      ) : null}

      {songMenu ? (
        <SongActionMenu
          key={songMenu.song.id}
          song={themePreview?.id === songMenu.song.id ? { ...songMenu.song, tags: themePreview.tags } : songMenu.song}
          anchor={songMenu.anchor}
          selected={selectedSongs.has(songMenu.song.id)}
          exporting={exporting}
          onClose={() => setSongMenu(null)}
          onOpenSong={() => {
            const target = songMenu.song;
            setSongMenu(null);
            primeSong(target);
            router.push(nav.songDetail(target.id));
          }}
          onEditThemes={canEditThemes ? () => {
            if (!themePreview) {
              setThemeEditor({ song: songMenu.song, anchor: songMenu.anchor });
              setSongMenu(null);
            }
          } : undefined}
          onToggleSelect={() => {
            setIsSelectionMode(true);
            toggleSong(songMenu.song);
            setSongMenu(null);
          }}
          onEditSong={canEditThemes ? () => {
            const target = songMenu.song;
            setSongMenu(null);
            primeSong(target);
            router.push(nav.songEdit(target.id));
          } : undefined}
          onExportPdf={() => {
            const target = songMenu.song;
            setSongMenu(null);
            void exportSingleSong(target);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, position: "relative", backgroundColor: colors.background },
  scroller: { flex: 1, width: "100%" },
  page: { flexGrow: 1, paddingVertical: spacing.xl, paddingBottom: screen.contentBottomPadding + spacing.xl },
  pageCompact: { paddingTop: spacing.md, paddingBottom: spacing.sm },
  contentShell: { width: "100%", maxWidth: screen.listMaxWidth, alignSelf: "center", paddingHorizontal: spacing.xl },
  contentShellCompact: { paddingHorizontal: spacing.lg },
  measuredContent: { width: "100%" },
  header: {
    flexDirection: "row",
    flexWrap: "nowrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  headerCompact: {
    marginBottom: spacing.md,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { ...uiPatterns.pageTitle },
  titleCompact: { fontSize: fontSizes.s24, lineHeight: lineHeights.h28, letterSpacing: -0.5 },
  subtitle: { ...uiPatterns.subtitle, marginTop: spacing.xs },
  subtitleCompact: { fontSize: fontSizes.s12, lineHeight: lineHeights.h17, marginTop: spacing.xxs },
  actions: { flexDirection: "row", flexWrap: "nowrap", flexShrink: 0, alignItems: "center", gap: spacing.sm },
  actionsCompact: { gap: 6 },
  iconButton: {
    width: controlSizes.compact,
    height: controlSizes.compact,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.primarySoftBorder,
  },
  transferIconButton: {
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
  },
  compactHeaderButton: {
    height: controlSizes.compact,
    minHeight: controlSizes.compact,
    paddingHorizontal: spacing.md,
  },
  compactNewSongButton: {
    paddingHorizontal: spacing.control,
  },
  headerButtonText: {
    fontSize: fontSizes.s13,
  },
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  searchInput: { flex: 1, minWidth: 0 },
  filterButton: {
    width: controlSizes.default,
    height: controlSizes.default,
    paddingHorizontal: 0,
    flexShrink: 0,
  },
  clearSearchButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  error: { marginBottom: spacing.sm },
  retryButton: { alignSelf: "flex-start", marginBottom: spacing.sm },
  selectionEntryText: { color: colors.primary, fontSize: fontSizes.s13, fontWeight: fontWeights.extrabold },
  singleColumn: { width: "100%" },
  mainColumn: { flex: 1, minWidth: 0, gap: spacing.lg },
  mainColumnCompact: { gap: spacing.sm },
  listContainer: {
    width: "100%",
    backgroundColor: "transparent",
  },
  listContainerCompact: {
    width: "auto",
    marginHorizontal: -spacing.lg,
  },
  listHeader: {
    minHeight: 30,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingTop: 0,
    paddingBottom: spacing.xs,
  },
  listHeaderCompact: {
    paddingHorizontal: spacing.lg,
  },
  tableHeader: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  tableHeaderIndex: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  tableHeaderTitle: {
    flex: 1,
    minWidth: 0,
  },
  tableHeaderTags: {
    width: 64,
    textAlign: "center",
  },
  tableHeaderMenu: {
    width: 44,
    marginLeft: spacing.xs,
  },
  tableHeaderText: {
    color: colors.muted,
    fontSize: fontSizes.s11,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.7,
  },
  headerCheck: {
    width: 18,
    height: 18,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCheckSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  listRows: {
    paddingHorizontal: 0,
    paddingVertical: spacing.xs,
    gap: 2,
  },
  listRowsCompact: {
    paddingVertical: 0,
    gap: 0,
  },
  listCount: { color: colors.muted, fontSize: fontSizes.s12, fontWeight: fontWeights.semibold },
  inlineLoading: { alignItems: "center", padding: spacing.xl },
  emptyState: { borderWidth: 0, borderRadius: 0 },
  emptyStateCompact: { marginHorizontal: spacing.lg },
  pagination: { width: "100%", maxWidth: 960, alignSelf: "center", flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  paginationCompact: { paddingTop: spacing.sm, paddingBottom: spacing.xs },
  pageNumbers: { position: "relative", flex: 1, maxWidth: 600, flexDirection: "row", alignItems: "center", marginHorizontal: spacing.sm },
  pageNavigation: { minWidth: 44, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  pageSlot: { flex: 1, minWidth: 0, minHeight: 48, alignItems: "center", justifyContent: "center" },
  pageNumberText: { color: colors.muted, fontSize: fontSizes.s14, fontWeight: fontWeights.medium },
  pageNumberActiveText: { color: colors.primary, fontWeight: fontWeights.bold },
  pageIndicator: { position: "absolute", left: 0, bottom: 0, width: 24, height: 2, borderRadius: 1, backgroundColor: colors.primary },
  pageArrow: { color: colors.muted, fontSize: fontSizes.s18 },
  link: { color: colors.muted, fontSize: fontSizes.s13, fontWeight: fontWeights.medium },
  pageText: { color: colors.muted, fontSize: fontSizes.s13 },
  disabledText: { opacity: 0.35 },
});
