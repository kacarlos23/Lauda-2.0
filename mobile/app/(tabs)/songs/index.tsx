import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Check, Download, Plus, Search, Settings2, Square, UserRound } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SongLinkButtons } from "../../../src/components/SongLinkButtons";
import { useAuthStore } from "../../../src/store/authStore";
import { useMusicStore } from "../../../src/store/musicStore";
import { musicService } from "../../../src/services/musicService";
import { canManageMusic } from "../../../src/utils/musicPermissions";
import { colors, radii, screen, spacing } from "../../../src/theme";

export default function SongsScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { songs, pagination, loading, error, loadSongs, primeSong } = useMusicStore();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);

  useFocusEffect(useCallback(() => { void loadSongs(search, page); }, [loadSongs, page]));
  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); void loadSongs(search, 1); }, 300);
    return () => clearTimeout(timer);
  }, [search, loadSongs]);

  const toggle = (id: string) => {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 50 ? [...current, id] : current);
  };
  const exportSelected = async () => {
    if (!selected.length) return;
    setExporting(true);
    try { await musicService.exportSongs(selected, `Cifras - ${new Date().toISOString().slice(0, 10)}.pdf`); }
    catch (reason) { Alert.alert("Erro", reason instanceof Error ? reason.message : "Não foi possível exportar as cifras."); }
    finally { setExporting(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View><Text style={styles.title}>Músicas</Text><Text style={styles.subtitle}>Cifras da sua igreja</Text></View>
          <View style={styles.actions}>
            {canManageMusic(user?.role) ? <TouchableOpacity style={styles.iconButton} onPress={() => router.push("/artists" as never)} accessibilityLabel="Gerenciar artistas"><Settings2 color={colors.primary} size={19} /></TouchableOpacity> : null}
            {canManageMusic(user?.role) ? <TouchableOpacity style={styles.primaryIcon} onPress={() => router.push("/songs/new" as never)} accessibilityLabel="Nova música"><Plus color={colors.surface} size={20} /></TouchableOpacity> : null}
          </View>
        </View>

        <View style={styles.searchRow}><Search color={colors.muted} size={18} /><TextInput style={styles.search} value={search} onChangeText={setSearch} placeholder="Buscar música ou artista" placeholderTextColor={colors.muted} /></View>
        <View style={styles.selectionBar}>
          <TouchableOpacity onPress={() => { setSelectionMode(!selectionMode); setSelected([]); }}><Text style={styles.link}>{selectionMode ? "Cancelar seleção" : "Selecionar para PDF"}</Text></TouchableOpacity>
          {selectionMode ? <TouchableOpacity onPress={() => setSelected(selected.length === songs.length ? [] : songs.slice(0, 50).map((song) => song.id))}><Text style={styles.link}>{selected.length === songs.length ? "Limpar" : "Selecionar página"}</Text></TouchableOpacity> : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <FlatList
          data={songs}
          keyExtractor={(item) => item.id}
          refreshing={loading}
          onRefresh={() => void loadSongs(search, page)}
          contentContainerStyle={songs.length ? styles.list : styles.emptyList}
          ListEmptyComponent={loading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.empty}>Nenhuma música encontrada.</Text>}
          renderItem={({ item }) => {
            const checked = selected.includes(item.id);
            return (
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
                <View style={styles.info}><Text style={styles.songTitle}>{item.title}</Text><Text style={styles.meta}>{item.artist.name} · Tom {item.originalKey}{item.bpm ? ` · ${item.bpm} BPM` : ""}</Text></View>
                {!selectionMode ? <SongLinkButtons links={item} compact /> : null}
                {selectionMode ? checked ? <View style={styles.check}><Check color={colors.surface} size={16} /></View> : <Square color={colors.muted} size={22} /> : null}
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={pagination.totalPages > 1 ? <View style={styles.pagination}><TouchableOpacity disabled={page <= 1} onPress={() => setPage(page - 1)}><Text style={[styles.link, page <= 1 && styles.disabledText]}>Anterior</Text></TouchableOpacity><Text style={styles.pageText}>{page} de {pagination.totalPages}</Text><TouchableOpacity disabled={page >= pagination.totalPages} onPress={() => setPage(page + 1)}><Text style={[styles.link, page >= pagination.totalPages && styles.disabledText]}>Próxima</Text></TouchableOpacity></View> : null}
        />

        {selectionMode && selected.length ? <TouchableOpacity style={styles.exportButton} onPress={() => void exportSelected()} disabled={exporting}><Download color={colors.surface} size={18} /><Text style={styles.exportText}>{exporting ? "Gerando..." : `Exportar ${selected.length} cifra(s)`}</Text></TouchableOpacity> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, container: { flex: 1, width: "100%", maxWidth: screen.listMaxWidth, alignSelf: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg }, title: { color: colors.ink, fontSize: 28, fontWeight: "800" }, subtitle: { color: colors.muted, fontSize: 14, marginTop: spacing.xs },
  actions: { flexDirection: "row", gap: spacing.sm }, iconButton: { width: 42, height: 42, borderRadius: radii.sm, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }, primaryIcon: { width: 42, height: 42, borderRadius: radii.sm, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  searchRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm, backgroundColor: colors.surface, paddingHorizontal: spacing.md }, search: { flex: 1, color: colors.ink, fontSize: 15 },
  selectionBar: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, link: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  list: { paddingBottom: 120, gap: spacing.sm }, emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center" }, empty: { color: colors.muted, fontSize: 15 },
  row: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surface }, rowSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceMuted }, avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }, info: { flex: 1 }, songTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" }, meta: { color: colors.muted, fontSize: 13, marginTop: spacing.xs }, check: { width: 22, height: 22, borderRadius: 5, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  error: { color: colors.danger, fontSize: 13, fontWeight: "700", marginBottom: spacing.sm }, pagination: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.lg }, pageText: { color: colors.muted, fontSize: 13, fontWeight: "700" }, disabledText: { opacity: 0.35 },
  exportButton: { position: "absolute", left: spacing.xl, right: spacing.xl, bottom: spacing.lg, minHeight: 50, borderRadius: radii.sm, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm }, exportText: { color: colors.surface, fontSize: 14, fontWeight: "800" },
});
