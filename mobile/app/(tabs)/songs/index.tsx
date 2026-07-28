import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  LayoutChangeEvent,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { MicVocal, Plus, Search, X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArtistPicker } from "../../../src/components/ArtistPicker";
import { SongExportPanel } from "../../../src/components/songs/SongExportPanel";
import { SongListRow } from "../../../src/components/songs/SongListRow";
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
import { useResponsiveLayout } from "../../../src/hooks/useResponsiveLayout";
import { useAuthStore } from "../../../src/store/authStore";
import { nav } from "../../../src/navigation/routes";
import { useMusicStore } from "../../../src/store/musicStore";
import { musicService, SongListParams, SongsUnavailableClientError } from "../../../src/services/musicService";
import { Artist, MUSICAL_KEYS, MusicalKey, Song } from "../../../src/types";
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
  radii,
  screen,
  spacing,
} from "../../../src/theme";

const WIDE_SELECTION_MIN_WIDTH = 1000;

const TEXT = {
  songOrArtist: "Música ou artista",
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
};

type Feedback = { message: string; tone: FeedbackTone };

const emptyFilters = (): SongFilterState => ({ artist: null, originalKey: undefined });

function toQueryFilters(filters: SongFilterState): SongListParams {
  return {
    ...(filters.artist ? { artistId: filters.artist.id } : {}),
    ...(filters.originalKey ? { originalKey: filters.originalKey } : {}),
  };
}

function filtersEqual(left: SongFilterState, right: SongFilterState): boolean {
  return left.artist?.id === right.artist?.id && left.originalKey === right.originalKey;
}

function totalLabel(total: number): string {
  return `${total} ${total === 1 ? "música encontrada" : "músicas encontradas"}`;
}

export default function SongsScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { screenHeight } = useResponsiveLayout();
  const { songs, pagination, loading, refreshing, error, listInvalidationVersion, loadSongs, primeSong } = useMusicStore();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSongs, setSelectedSongs] = useState<Map<string, SongSelectionSnapshot>>(() => new Map());
  const [exportPanelExpanded, setExportPanelExpanded] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [contentWidth, setContentWidth] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SongFilterState>(emptyFilters);
  const [draftFilters, setDraftFilters] = useState<SongFilterState>(emptyFilters);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const searchRef = useRef(search);
  const pageRef = useRef(page);
  const filtersRef = useRef<SongListParams>(toQueryFilters(filters));
  const exportingRef = useRef(false);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didMountSearchRef = useRef(false);
  const didMountPageRef = useRef(false);
  const handledInvalidationRef = useRef(listInvalidationVersion);

  useEffect(() => { searchRef.current = search; }, [search]);
  useEffect(() => { pageRef.current = page; }, [page]);

  useEffect(() => () => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
  }, []);

  const showFeedback = useCallback((message: string, tone: FeedbackTone = "success") => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedback({ message, tone });
    AccessibilityInfo?.announceForAccessibility?.(message);
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 4200);
  }, []);

  const loadVisibleSongs = useCallback((forceRefresh = false) => {
    const hasCachedSongs = useMusicStore.getState().songs.length > 0;
    void loadSongs(searchRef.current, pageRef.current, {
      refresh: forceRefresh || hasCachedSongs,
      filters: filtersRef.current,
    });
  }, [loadSongs]);

  useFocusEffect(useCallback(() => {
    loadVisibleSongs();
  }, [loadVisibleSongs]));

  useEffect(() => {
    if (!didMountSearchRef.current) {
      didMountSearchRef.current = true;
      return undefined;
    }

    const timer = setTimeout(() => {
      searchRef.current = search;
      pageRef.current = 1;
      setPage(1);
      const hasCachedSongs = useMusicStore.getState().songs.length > 0;
      void loadSongs(search, 1, { refresh: hasCachedSongs, filters: filtersRef.current });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, loadSongs]);

  useEffect(() => {
    if (!didMountPageRef.current) {
      didMountPageRef.current = true;
      return;
    }

    pageRef.current = page;
    const hasCachedSongs = useMusicStore.getState().songs.length > 0;
    void loadSongs(searchRef.current, page, { refresh: hasCachedSongs, filters: filtersRef.current });
  }, [page, loadSongs]);

  useEffect(() => {
    if (handledInvalidationRef.current === listInvalidationVersion) return;
    handledInvalidationRef.current = listInvalidationVersion;
    loadVisibleSongs(true);
  }, [listInvalidationVersion, loadVisibleSongs]);

  useEffect(() => {
    if (!selectedSongs.size || !songs.length) return;
    setSelectedSongs((current) => reconcileSongSelection(current, songs));
  }, [songs, selectedSongs.size]);

  const selectedList = useMemo(() => Array.from(selectedSongs.values()), [selectedSongs]);
  const allPageSelected = songs.length > 0 && songs.every((song) => selectedSongs.has(song.id));
  const activeFilters = Boolean(filters.artist || filters.originalKey);
  const canApplyFilters = !filtersEqual(filters, draftFilters);
  const hasDraftFilters = Boolean(draftFilters.artist || draftFilters.originalKey);
  const isWideSelectionLayout = isSelectionMode && contentWidth >= WIDE_SELECTION_MIN_WIDTH;

  const toggleSong = useCallback((song: Song) => {
    setSelectedSongs((current) => {
      const result = toggleSongSelection(current, song);
      if (result.limitReached) {
        showFeedback("O limite é de 50 cifras.", "warning");
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
          `${result.added} de ${result.candidates} músicas adicionadas. O limite é de 50 cifras.`,
          "warning"
        );
      }
      return result.selection;
    });
  }, [showFeedback, songs]);

  const cancelSelection = useCallback(() => {
    setSelectedSongs(new Map());
    setIsSelectionMode(false);
    setExportPanelExpanded(true);
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
        Alert.alert("Erro", reason instanceof Error ? reason.message : TEXT.exportError);
      }
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  }, [selectedSongs, showFeedback]);

  const openFilters = useCallback(() => {
    setDraftFilters(filters);
    setShowFilters(true);
  }, [filters]);

  const commitFilters = useCallback((next: SongFilterState) => {
    const queryFilters = toQueryFilters(next);
    filtersRef.current = queryFilters;
    setFilters(next);
    setDraftFilters(next);
    setShowFilters(false);
    pageRef.current = 1;
    setPage(1);
    const hasCachedSongs = useMusicStore.getState().songs.length > 0;
    void loadSongs(searchRef.current, 1, { refresh: hasCachedSongs, filters: queryFilters });
  }, [loadSongs]);

  const applyFilters = useCallback(() => commitFilters(draftFilters), [commitFilters, draftFilters]);
  const clearFilters = useCallback(() => commitFilters(emptyFilters()), [commitFilters]);

  const handleContentLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    setContentWidth((current) => current === nextWidth ? current : nextWidth);
  }, []);

  const selectionPanel = isSelectionMode ? (
    <SongExportPanel
      songs={selectedList}
      compact={!isWideSelectionLayout}
      expanded={exportPanelExpanded}
      screenHeight={screenHeight}
      exporting={exporting}
      onToggleExpanded={() => setExportPanelExpanded((current) => !current)}
      onRemove={(songId) => setSelectedSongs((current) => {
        const next = new Map(current);
        next.delete(songId);
        return next;
      })}
      onExport={() => void exportSelected()}
      onCancel={cancelSelection}
    />
  ) : null;

  const wideLayoutStyle = Platform.OS === "web"
    ? ({ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", columnGap: spacing.xl, alignItems: "start" } as unknown as ViewStyle)
    : styles.wideLayoutFallback;
  const stickyPanelStyle = Platform.OS === "web"
    ? ({ position: "sticky", top: spacing.xl, width: 320, alignSelf: "start" } as unknown as ViewStyle)
    : styles.stickyPanelFallback;

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

      <ScrollView
        style={styles.scroller}
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadSongs(searchRef.current, pageRef.current, { refresh: true, filters: filtersRef.current })}
            colors={[colors.primary]}
          />
        )}
      >
        <View style={styles.contentShell}>
          <View style={styles.measuredContent} onLayout={handleContentLayout} testID="songs-content-width">
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>{TEXT.songs}</Text>
                <Text style={styles.subtitle}>Cifras da sua igreja</Text>
              </View>
              <View style={styles.actions}>
                {canManageMusic(user, "song:edit") || canManageMusic(user, "song:create") ? (
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => router.push(nav.artists)}
                    accessibilityRole="button"
                    accessibilityLabel="Gerenciar artistas"
                  >
                    <MicVocal color={colors.primary} size={iconSizes.s19} />
                  </TouchableOpacity>
                ) : null}
                {canManageMusic(user, "song:create") ? (
                  <Button
                    title={TEXT.newSong}
                    icon={<Plus color={colors.surface} size={iconSizes.s19} />}
                    onPress={() => router.push(nav.songNew)}
                    accessibilityLabel={TEXT.newSong}
                    style={styles.newSongButton}
                  />
                ) : null}
              </View>
            </View>

            <View style={styles.searchRow}>
              <AppInput
                value={search}
                onChangeText={setSearch}
                placeholder={TEXT.songOrArtist}
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
                label="Filtros"
                active={activeFilters}
                onPress={openFilters}
                accessibilityLabel="Abrir filtros de músicas"
                style={styles.filterButton}
              />
            </View>

            <ErrorBanner
              message={error}
              style={styles.error}
              action={error ? (
                <Button
                  title="Tentar novamente"
                  variant="secondary"
                  size="sm"
                  style={styles.retryButton}
                  onPress={() => loadVisibleSongs(true)}
                  accessibilityLabel={TEXT.retryLoadSongs}
                />
              ) : null}
            />

            {!isSelectionMode ? (
              <View style={styles.selectionEntry}>
                <TouchableOpacity
                  onPress={() => { setIsSelectionMode(true); setExportPanelExpanded(true); }}
                  accessibilityRole="button"
                  accessibilityLabel="Selecionar músicas para PDF"
                >
                  <Text style={styles.selectionEntryText}>Selecionar para PDF</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View
              style={isWideSelectionLayout ? wideLayoutStyle : styles.singleColumn}
              testID={isWideSelectionLayout ? "songs-selection-layout-wide" : "songs-selection-layout-compact"}
            >
              <View style={styles.mainColumn}>
                {isSelectionMode && !isWideSelectionLayout ? selectionPanel : null}
                {isSelectionMode ? (
                  <SongSelectionSummary
                    selectedCount={selectedSongs.size}
                    pageEmpty={!songs.length}
                    allPageSelected={allPageSelected}
                    onTogglePage={togglePageSelection}
                    onClear={() => setSelectedSongs(new Map())}
                  />
                ) : null}

                <View style={styles.listCard}>
                  <View style={styles.listHeader}>
                    <Text style={styles.listCount} accessibilityLiveRegion="polite">{totalLabel(pagination.total)}</Text>
                  </View>

                  {(loading || refreshing) && !songs.length ? (
                    <LoadingState centered={false} message={TEXT.loadingSongs} style={styles.inlineLoading} />
                  ) : !songs.length ? (
                    <EmptyState
                      title={TEXT.noSongsFound}
                      description={search.trim() || activeFilters ? "Tente ajustar a busca ou limpar os filtros." : TEXT.registerSongs}
                      style={styles.emptyState}
                    />
                  ) : (
                    songs.map((song, index) => (
                      <SongListRow
                        key={song.id}
                        song={song}
                        selectionMode={isSelectionMode}
                        selected={selectedSongs.has(song.id)}
                        isLast={index === songs.length - 1}
                        onPress={() => {
                          if (isSelectionMode) {
                            toggleSong(song);
                            return;
                          }
                          primeSong(song);
                          router.push(nav.songDetail(song.id));
                        }}
                      />
                    ))
                  )}
                </View>

                {pagination.totalPages > 1 ? (
                  <View style={styles.pagination}>
                    <TouchableOpacity disabled={page <= 1} onPress={() => setPage(page - 1)}>
                      <Text style={[styles.link, page <= 1 && styles.disabledText]}>Anterior</Text>
                    </TouchableOpacity>
                    <Text style={styles.pageText}>{page} de {pagination.totalPages}</Text>
                    <TouchableOpacity disabled={page >= pagination.totalPages} onPress={() => setPage(page + 1)}>
                      <Text style={[styles.link, page >= pagination.totalPages && styles.disabledText]}>{TEXT.nextPage}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>

              {isWideSelectionLayout ? (
                <View style={stickyPanelStyle} testID="songs-export-panel-sticky">{selectionPanel}</View>
              ) : null}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroller: { flex: 1, width: "100%" },
  page: { flexGrow: 1, paddingVertical: spacing.xl, paddingBottom: screen.contentBottomPadding + spacing.xl },
  contentShell: { width: "100%", maxWidth: screen.listMaxWidth, alignSelf: "center", paddingHorizontal: spacing.xl },
  measuredContent: { width: "100%" },
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  headerCopy: { flexGrow: 1 },
  title: { color: colors.ink, fontSize: fontSizes.s30, fontWeight: fontWeights.black },
  subtitle: { color: colors.muted, fontSize: fontSizes.s14, marginTop: spacing.xs, fontWeight: fontWeights.bold },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  iconButton: {
    width: controlSizes.default,
    height: controlSizes.default,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.primarySoftBorder,
  },
  newSongButton: { minWidth: 150 },
  searchRow: { flexDirection: "row", alignItems: "stretch", gap: spacing.md, marginBottom: spacing.md },
  searchInput: { flex: 1 },
  filterButton: { height: 50 },
  clearSearchButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  error: { marginBottom: spacing.sm },
  retryButton: { alignSelf: "flex-start", marginBottom: spacing.sm },
  selectionEntry: { minHeight: controlSizes.default, alignItems: "flex-start", justifyContent: "center", marginBottom: spacing.sm },
  selectionEntryText: { color: colors.primary, fontSize: fontSizes.s13, fontWeight: fontWeights.extrabold },
  singleColumn: { width: "100%" },
  wideLayoutFallback: { width: "100%", flexDirection: "row", alignItems: "flex-start", gap: spacing.xl },
  stickyPanelFallback: { width: 320, alignSelf: "flex-start" },
  mainColumn: { flex: 1, minWidth: 0, gap: spacing.lg },
  listCard: {
    width: "100%",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  listHeader: { minHeight: 50, justifyContent: "center", paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  listCount: { color: colors.text, fontSize: fontSizes.s14, fontWeight: fontWeights.extrabold },
  inlineLoading: { alignItems: "center", padding: spacing.xl },
  emptyState: { borderWidth: 0, borderRadius: 0 },
  pagination: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.lg },
  link: { color: colors.primary, fontSize: fontSizes.s13, fontWeight: fontWeights.extrabold },
  pageText: { color: colors.muted, fontSize: fontSizes.s13, fontWeight: fontWeights.bold },
  disabledText: { opacity: 0.35 },
});
