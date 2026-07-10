import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Check, Download, Plus, Settings2, Square, UserRound } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SongLinkButtons } from "../../../src/components/SongLinkButtons";
import { AppInput, Button, EmptyState, ErrorBanner, FilterButton, FilterPanel, LoadingState } from "../../../src/components/ui";
import { useAuthStore } from "../../../src/store/authStore";
import { useMusicStore } from "../../../src/store/musicStore";
import { musicService } from "../../../src/services/musicService";
import { canManageMusic } from "../../../src/utils/musicPermissions";
import { buttonShadow, colors, radii, screen, shadow, spacing } from "../../../src/theme";

export default function SongsScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { songs, pagination, loading, refreshing, error, listInvalidationVersion, loadSongs, primeSong } = useMusicStore();
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const searchRef = useRef(search);
  const pageRef = useRef(page);
  const didMountSearchRef = useRef(false);
  const didMountPageRef = useRef(false);
  const handledInvalidationRef = useRef(listInvalidationVersion);

  useEffect(() => { searchRef.current = search; }, [search]);
  useEffect(() => { pageRef.current = page; }, [page]);

  const loadVisibleSongs = useCallback((forceRefresh = false) => {
    const hasCachedSongs = useMusicStore.getState().songs.length > 0;
    void loadSongs(searchRef.current, pageRef.current, { refresh: forceRefresh || hasCachedSongs });
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
      void loadSongs(search, 1, { refresh: hasCachedSongs });
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
    void loadSongs(searchRef.current, page, { refresh: hasCachedSongs });
  }, [page, loadSongs]);

  useEffect(() => {
    if (handledInvalidationRef.current === listInvalidationVersion) return;
    handledInvalidationRef.current = listInvalidationVersion;
    loadVisibleSongs(true);
  }, [listInvalidationVersion, loadVisibleSongs]);

  const toggle = (id: string) => {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 50 ? [...current, id] : current);
  };

  const activeFilters = Boolean(search.trim());
  const canApplyFilters = Boolean(draftSearch.trim());
  const openFilters = () => {
    setDraftSearch(search);
    setShowFilters(true);
  };
  const clearFilters = () => {
    setSearch("");
    setDraftSearch("");
    setShowFilters(false);
  };
  const applyFilters = () => {
    if (!draftSearch.trim()) return;
    setSearch(draftSearch);
    setShowFilters(false);
  };

  const exportSelected = async () => {
    if (!selected.length) return;
    setExporting(true);
    try {
      await musicService.exportSongs(selected, `Cifras - ${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (reason) {
      Alert.alert("Erro", reason instanceof Error ? reason.message : "Não foi possível exportar as cifras.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <FilterPanel
        visible={showFilters}
        title="Filtrar músicas"
        canApply={canApplyFilters}
        onApply={applyFilters}
        onClose={() => setShowFilters(false)}
        onClear={activeFilters || canApplyFilters ? clearFilters : undefined}
      >
        <AppInput
          label="Palavra-chave geral"
          value={draftSearch}
          onChangeText={setDraftSearch}
          placeholder="Música ou artista"
          accessibilityLabel="Buscar músicas"
        />
      </FilterPanel>
      <View style={styles.container}>
        <View style={styles.contentHeader}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Músicas</Text>
              <Text style={styles.subtitle}>Cifras da sua igreja</Text>
            </View>
            <View style={styles.actions}>
              <FilterButton active={activeFilters} onPress={openFilters} accessibilityLabel="Abrir filtros de músicas" />
              {canManageMusic(user, "song:edit") || canManageMusic(user, "song:create") ? (
                <TouchableOpacity style={styles.iconButton} onPress={() => router.push("/artists" as never)} accessibilityLabel="Gerenciar artistas">
                  <Settings2 color={colors.primary} size={19} />
                </TouchableOpacity>
              ) : null}
              {canManageMusic(user, "song:create") ? (
                <TouchableOpacity style={styles.primaryIcon} onPress={() => router.push("/songs/new" as never)} accessibilityLabel="Nova música">
                  <Plus color={colors.surface} size={20} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {activeFilters ? (
            <Button
              title="Limpar filtros"
              variant="ghost"
              size="sm"
              style={styles.clearFiltersButton}
              onPress={clearFilters}
              accessibilityLabel="Limpar filtros de músicas"
            />
          ) : null}
          <View style={styles.selectionBar}>
            <TouchableOpacity onPress={() => { setSelectionMode(!selectionMode); setSelected([]); }}>
              <Text style={styles.link}>{selectionMode ? "Cancelar seleção" : "Selecionar para PDF"}</Text>
            </TouchableOpacity>
            {selectionMode ? (
              <TouchableOpacity onPress={() => setSelected(selected.length === songs.length ? [] : songs.slice(0, 50).map((song) => song.id))}>
                <Text style={styles.link}>{selected.length === songs.length ? "Limpar" : "Selecionar página"}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
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
              accessibilityLabel="Tentar carregar músicas novamente"
            />
          ) : null}
        />
        <FlatList
          style={styles.listScroller}
          data={songs}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={() => void loadSongs(search, page, { refresh: true })}
          removeClippedSubviews={false}
          contentContainerStyle={songs.length ? styles.list : styles.emptyList}
          ListEmptyComponent={(loading || refreshing) && !songs.length ? (
            <LoadingState centered={false} message="Carregando músicas..." style={styles.inlineLoading} />
          ) : (
            <EmptyState
              title="Nenhuma música encontrada"
              description={search.trim() ? "Tente ajustar a busca ou limpar o termo pesquisado." : "Cadastre músicas para montar repertórios e escalas."}
            />
          )}
          renderItem={({ item }) => {
            const checked = selected.includes(item.id);
            return (
              <View style={styles.rowShadowFrame}>
                <TouchableOpacity
                  style={[styles.row, checked && styles.rowSelected]}
                  onPress={() => {
                    if (selectionMode) {
                      toggle(item.id);
                      return;
                    }
                    primeSong(item);
                    router.push(`/songs/${item.id}` as never);
                  }}
                >
                  {item.artist.imageUrl ? <Image source={{ uri: item.artist.imageUrl }} style={styles.avatar} /> : <View style={styles.avatarPlaceholder}><UserRound color={colors.primary} size={20} /></View>}
                  <View style={styles.info}>
                    <Text style={styles.songTitle}>{item.title}</Text>
                    <Text style={styles.meta}>{item.artist.name} · Tom {item.originalKey}{item.bpm ? ` · ${item.bpm} BPM` : ""}</Text>
                  </View>
                  {!selectionMode ? <SongLinkButtons links={item} compact /> : null}
                  {selectionMode ? checked ? <View style={styles.check}><Check color={colors.surface} size={16} /></View> : <Square color={colors.muted} size={22} /> : null}
                </TouchableOpacity>
              </View>
            );
          }}
          ListFooterComponent={pagination.totalPages > 1 ? (
            <View style={styles.pagination}>
              <TouchableOpacity disabled={page <= 1} onPress={() => setPage(page - 1)}>
                <Text style={[styles.link, page <= 1 && styles.disabledText]}>Anterior</Text>
              </TouchableOpacity>
              <Text style={styles.pageText}>{page} de {pagination.totalPages}</Text>
              <TouchableOpacity disabled={page >= pagination.totalPages} onPress={() => setPage(page + 1)}>
                <Text style={[styles.link, page >= pagination.totalPages && styles.disabledText]}>Próxima</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        />

        {selectionMode && selected.length ? (
          <TouchableOpacity style={styles.exportButton} onPress={() => void exportSelected()} disabled={exporting}>
            <Download color={colors.surface} size={18} />
            <Text style={styles.exportText}>{exporting ? "Gerando..." : `Exportar ${selected.length} cifra(s)`}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, width: "100%", paddingTop: spacing.lg },
  contentHeader: { width: "100%", maxWidth: screen.listMaxWidth, alignSelf: "center", paddingHorizontal: spacing.xl },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg },
  title: { color: colors.ink, fontSize: 30, fontWeight: "900" },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: spacing.xs, fontWeight: "700" },
  actions: { flexDirection: "row", gap: spacing.sm },
  iconButton: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#BFE7DE" },
  primaryIcon: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", ...buttonShadow },
  clearFiltersButton: { alignSelf: "flex-start", marginTop: spacing.sm },
  selectionBar: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  link: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  listScroller: { flex: 1, width: "100%" },
  list: { width: "100%", maxWidth: screen.listMaxWidth, alignSelf: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.xs, paddingBottom: screen.contentBottomPadding },
  emptyList: { flexGrow: 1, width: "100%", maxWidth: screen.listMaxWidth, alignSelf: "center", alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, paddingBottom: screen.contentBottomPadding },
  inlineLoading: { alignItems: "center" },
  rowShadowFrame: { paddingVertical: spacing.xs, overflow: "visible" },
  row: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radii.xl, backgroundColor: colors.surface, ...shadow },
  rowSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceMuted },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  info: { flex: 1 },
  songTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 13, marginTop: spacing.xs },
  check: { width: 22, height: 22, borderRadius: 5, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  error: { color: colors.danger, fontSize: 13, fontWeight: "700", marginHorizontal: spacing.xl, marginBottom: spacing.sm, backgroundColor: colors.dangerSoft, padding: spacing.md, borderRadius: radii.md },
  retryButton: { alignSelf: "flex-start", marginHorizontal: spacing.xl, marginBottom: spacing.sm },
  pagination: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.lg },
  pageText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  disabledText: { opacity: 0.35 },
  exportButton: { position: "absolute", left: spacing.xl, right: spacing.xl, bottom: 96, minHeight: 52, borderRadius: radii.md, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, ...buttonShadow },
  exportText: { color: colors.surface, fontSize: 14, fontWeight: "900" },
});
