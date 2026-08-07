import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Download, Edit3, Pause, Play, Trash2 } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { cancelAnimation, Easing, runOnJS, scrollTo, useAnimatedReaction, useAnimatedRef, useAnimatedScrollHandler, useSharedValue, withTiming } from "react-native-reanimated";
import { AppBackButton } from "../../../src/components/AppBackButton";
import { ChordSheetView } from "../../../src/components/ChordSheetView";
import { SongLinkButtons } from "../../../src/components/SongLinkButtons";
import { YouTubePlayerCard } from "../../../src/components/YouTubePlayerCard";
import { Button, ErrorBanner, LoadingState } from "../../../src/components/ui";
import { RichCommentView } from "../../../src/components/ui/RichCommentView";
import { musicService } from "../../../src/services/musicService";
import { useAuthStore } from "../../../src/store/authStore";
import { useChordStore } from "../../../src/store/chordStore";
import { useMusicStore } from "../../../src/store/musicStore";
import {
  colors,
  controlSizes,
  fontSizes,
  fontWeights,
  iconSizes,
  radii,
  screen,
  spacing,
  zIndices,
} from "../../../src/theme";
import { canManageMusic } from "../../../src/utils/musicPermissions";
import { getSongDetailViewState } from "../../../src/utils/songDetailState";
import { nav } from "../../../src/navigation/routes";
import { extractYouTubeVideoId } from "../../../src/utils/youtube";

export default function SongDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { currentSong, detailLoading, detailError, requestedSongId, loadSong, deleteSong, saving } = useMusicStore();
  const chord = useChordStore();
  const [exporting, setExporting] = useState(false);
  const [autoScrolling, setAutoScrolling] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  const showSideBySideMedia = Platform.OS === "web" && windowWidth >= 1280;
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const animatedY = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  const contentHeight = useSharedValue(0);

  useFocusEffect(useCallback(() => { if (id) void loadSong(id); }, [id, loadSong]));
  const viewState = getSongDetailViewState({ routeSongId: id, currentSong, requestedSongId, detailLoading, detailError });
  const readySong = viewState.status === "ready" ? viewState.song : null;

  useEffect(() => { if (readySong) chord.initializeSong(readySong.id, readySong.originalKey); }, [readySong?.id, readySong?.originalKey]);

  const onScroll = useAnimatedScrollHandler((event) => { scrollY.value = event.contentOffset.y; });
  useAnimatedReaction(() => animatedY.value, (value) => { scrollTo(scrollRef, 0, value, false); });

  const stopAutoScroll = useCallback(() => {
    cancelAnimation(animatedY);
    setAutoScrolling(false);
  }, [animatedY]);

  const toggleAutoScroll = () => {
    if (autoScrolling) return stopAutoScroll();
    const destination = Math.max(0, contentHeight.value - viewportHeight.value);
    const remaining = Math.max(0, destination - scrollY.value);
    if (!remaining) return;
    const bpm = viewState.status === "ready" ? viewState.song.bpm ?? 90 : 90;
    const pixelsPerSecond = Math.max(12, Math.min(120, (bpm / 60) * 18 * chord.scrollSpeed));
    animatedY.value = scrollY.value;
    setAutoScrolling(true);
    animatedY.value = withTiming(destination, { duration: remaining / pixelsPerSecond * 1000, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(setAutoScrolling)(false);
    });
  };

  if (viewState.status === "loading") return <LoadingState message="Carregando música..." />;
  if (viewState.status === "error") return <View style={styles.center}><ErrorBanner message={viewState.message} style={styles.error} action={id ? <Button title="Tentar novamente" variant="secondary" onPress={() => loadSong(id)} /> : undefined} /><AppBackButton href={nav.songs} /></View>;
  const song = viewState.song;
  const hasEmbeddedVideo = Boolean(song.videoUrl && extractYouTubeVideoId(song.videoUrl));
  const externalLinks = hasEmbeddedVideo ? { ...song, videoUrl: null } : song;
  const youtubePlayer = hasEmbeddedVideo && song.videoUrl
    ? <YouTubePlayerCard videoUrl={song.videoUrl} title={song.title} />
    : null;

  const exportPdf = async () => {
    setExporting(true);
    try { await musicService.exportSongs([song.id], `${song.artist.name} - ${song.title}.pdf`, { [song.id]: chord.semitoneOffset }); }
    catch (reason) { Alert.alert("Erro", reason instanceof Error ? reason.message : "Não foi possível exportar a cifra."); }
    finally { setExporting(false); }
  };

  const confirmDelete = () => {
    Alert.alert("Excluir música", `Deseja excluir “${song.title}”?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => void deleteSong(song.id)
          .then(() => router.replace(nav.songs))
          .catch((reason) => Alert.alert("Erro", reason instanceof Error ? reason.message : "Não foi possível excluir a música.")),
      },
    ]);
  };

  return <SafeAreaView style={styles.safe} edges={["left", "right"]}>
    <View style={styles.top}><AppBackButton href={nav.songs} compact /><View style={styles.topActions}>{canManageMusic(user, "song:edit") ? <TouchableOpacity accessibilityLabel="Editar música" style={styles.icon} onPress={() => router.push(nav.songEdit(song.id))}><Edit3 color={colors.primary} size={iconSizes.s19} /></TouchableOpacity> : null}{canManageMusic(user, "song:delete") ? <TouchableOpacity accessibilityLabel="Excluir música" style={styles.icon} onPress={confirmDelete} disabled={saving}><Trash2 color={colors.danger} size={iconSizes.s19} /></TouchableOpacity> : null}<TouchableOpacity accessibilityLabel="Exportar PDF" style={styles.icon} onPress={() => void exportPdf()} disabled={exporting}>{exporting ? <ActivityIndicator color={colors.primary} /> : <Download color={colors.primary} size={iconSizes.s19} />}</TouchableOpacity></View></View>
    <Animated.ScrollView
      ref={scrollRef}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onLayout={(event) => { viewportHeight.value = event.nativeEvent.layout.height; }}
      onContentSizeChange={(_, height) => { contentHeight.value = height; }}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>{song.title}</Text><Text style={styles.artist}>{song.artist.name}</Text>
      <View style={styles.metadata}><Text style={styles.meta}>Tom original: {song.originalKey}</Text>{song.bpm ? <Text style={styles.meta}>{song.bpm} BPM</Text> : null}{song.composer ? <Text style={styles.meta}>Compositor: {song.composer}</Text> : null}</View>
      <View style={styles.mediaSection}>
        <SongLinkButtons links={externalLinks} centered />
      </View>
      {song.comments ? <View style={styles.commentsCard}><Text style={styles.commentsTitle}>Comentários</Text><RichCommentView value={song.comments} /></View> : null}
      {!showSideBySideMedia && youtubePlayer ? <View style={styles.stackedPlayer}>{youtubePlayer}</View> : null}
      <View style={[styles.workspace, showSideBySideMedia && styles.workspaceWide]}>
        <View style={[styles.sheetPanel, showSideBySideMedia && styles.sheetPanelWide]} testID="song-chord-panel">
          <View style={styles.controlToolbar}>
            <View style={styles.controls}>
              <Control label={"\u22121 Tom"} onPress={() => chord.transpose(-1)} testID="transpose-down" />
              <TouchableOpacity style={styles.keyControl} onPress={chord.resetTranspose} testID="current-key"><Text style={styles.currentKey}>{chord.currentKey}</Text><Text style={styles.reset}>restaurar</Text></TouchableOpacity>
              <Control label="+1 Tom" onPress={() => chord.transpose(1)} testID="transpose-up" />
            </View>
            <View style={styles.controls}>
              <Control label={"A\u2212"} onPress={() => chord.changeFontSize(-2)} testID="font-down" />
              <Text style={styles.controlValue}>{chord.fontSize}px</Text>
              <Control label="A+" onPress={() => chord.changeFontSize(2)} testID="font-up" />
              <Control label={`${chord.scrollSpeed.toFixed(2)}\u00d7`} onPress={() => chord.changeScrollSpeed(0.25)} testID="scroll-speed" />
              <TouchableOpacity style={[styles.play, autoScrolling && styles.playActive]} onPress={toggleAutoScroll} testID="auto-scroll">{autoScrolling ? <Pause color={colors.surface} size={iconSizes.s18} /> : <Play color={colors.surface} size={iconSizes.s18} />}<Text style={styles.playText}>{autoScrolling ? "Pausar" : "Rolar"}</Text></TouchableOpacity>
            </View>
          </View>
          <View style={styles.chordCard}><ChordSheetView content={song.content} originalKey={song.originalKey} semitones={chord.semitoneOffset} fontSize={chord.fontSize} /></View>
        </View>
        {showSideBySideMedia && youtubePlayer ? <View style={styles.playerColumn}>{youtubePlayer}</View> : null}
      </View>
    </Animated.ScrollView>
  </SafeAreaView>;
}

function Control({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  return <TouchableOpacity style={styles.control} onPress={onPress} testID={testID}><Text style={styles.controlText}>{label}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, padding: spacing.xl },
  top: { width: "100%", maxWidth: screen.listMaxWidth, alignSelf: "center", minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, paddingHorizontal: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.line }, topActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }, icon: { width: controlSizes.default, height: controlSizes.default, borderRadius: radii.md, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  content: { width: "100%", maxWidth: screen.listMaxWidth, alignSelf: "center", padding: spacing.xl, paddingBottom: screen.contentBottomPadding }, title: { color: colors.ink, fontSize: fontSizes.s34, fontWeight: fontWeights.extrabold }, artist: { color: colors.primary, fontSize: fontSizes.s17, fontWeight: fontWeights.bold, marginTop: spacing.xs }, metadata: { flexDirection: "row", flexWrap: "wrap", marginVertical: spacing.md, gap: spacing.md }, meta: { color: colors.muted, fontSize: fontSizes.s13, fontWeight: fontWeights.semibold },
  mediaSection: { alignItems: "flex-start", gap: spacing.md, marginBottom: spacing.lg },
  commentsCard: { marginBottom: spacing.lg, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line }, commentsTitle: { color: colors.ink, fontSize: fontSizes.s13, fontWeight: fontWeights.extrabold, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: spacing.sm },
  stackedPlayer: { width: "100%", marginBottom: spacing.lg },
  workspace: { width: "100%" },
  workspaceWide: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xl },
  sheetPanel: { width: "100%", borderWidth: 1, borderColor: colors.line, borderRadius: radii.lg, backgroundColor: colors.surface },
  sheetPanelWide: { flex: 1.9, minWidth: 0 },
  playerColumn: { flex: 1, minWidth: 320, maxWidth: 480 },
  controlToolbar: { position: Platform.OS === "web" ? "sticky" as any : "relative", top: 0, zIndex: zIndices.sticky, flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: spacing.md, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, backgroundColor: colors.surface },
  controls: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm }, control: { minHeight: controlSizes.default, minWidth: 52, paddingHorizontal: spacing.md, borderRadius: radii.md, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }, controlText: { color: colors.primary, fontWeight: fontWeights.extrabold }, keyControl: { minWidth: 72, minHeight: controlSizes.default, alignItems: "center", justifyContent: "center" }, currentKey: { color: colors.ink, fontSize: fontSizes.s22, fontWeight: fontWeights.black }, reset: { color: colors.muted, fontSize: fontSizes.s9 }, controlValue: { color: colors.text, fontWeight: fontWeights.bold },
  play: { minHeight: controlSizes.default, paddingHorizontal: spacing.md, borderRadius: radii.md, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", gap: spacing.xs }, playActive: { backgroundColor: colors.danger }, playText: { color: colors.surface, fontWeight: fontWeights.extrabold },
  chordCard: { minHeight: 520, borderLeftWidth: 3, borderLeftColor: colors.accent, borderBottomLeftRadius: radii.lg, borderBottomRightRadius: radii.lg, backgroundColor: colors.surface, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg }, error: { color: colors.danger, marginBottom: spacing.md },
});
