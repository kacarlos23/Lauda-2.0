import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Download, Edit3, Pause, Play } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { cancelAnimation, Easing, runOnJS, scrollTo, useAnimatedReaction, useAnimatedRef, useAnimatedScrollHandler, useSharedValue, withTiming } from "react-native-reanimated";
import { AppBackButton } from "../../../src/components/AppBackButton";
import { ChordSheetView } from "../../../src/components/ChordSheetView";
import { SongLinkButtons } from "../../../src/components/SongLinkButtons";
import { musicService } from "../../../src/services/musicService";
import { useAuthStore } from "../../../src/store/authStore";
import { useChordStore } from "../../../src/store/chordStore";
import { useMusicStore } from "../../../src/store/musicStore";
import { colors, radii, screen, spacing } from "../../../src/theme";
import { canManageMusic } from "../../../src/utils/musicPermissions";
import { getSongDetailViewState } from "../../../src/utils/songDetailState";

export default function SongDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { currentSong, detailLoading, detailError, requestedSongId, loadSong } = useMusicStore();
  const chord = useChordStore();
  const [exporting, setExporting] = useState(false);
  const [autoScrolling, setAutoScrolling] = useState(false);
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

  if (viewState.status === "loading") return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  if (viewState.status === "error") return <View style={styles.center}><Text style={styles.error}>{viewState.message}</Text><AppBackButton href="/songs" /></View>;
  const song = viewState.song;

  const exportPdf = async () => {
    setExporting(true);
    try { await musicService.exportSongs([song.id], `${song.artist.name} - ${song.title}.pdf`, { [song.id]: chord.semitoneOffset }); }
    catch (reason) { Alert.alert("Erro", reason instanceof Error ? reason.message : "Não foi possível exportar a cifra."); }
    finally { setExporting(false); }
  };

  return <SafeAreaView style={styles.safe} edges={["left", "right"]}>
    <View style={styles.top}><AppBackButton href="/songs" compact /><View style={styles.topActions}>{canManageMusic(user?.role) ? <TouchableOpacity accessibilityLabel="Editar música" style={styles.icon} onPress={() => router.push(`/songs/${song.id}/edit` as never)}><Edit3 color={colors.primary} size={19} /></TouchableOpacity> : null}<TouchableOpacity accessibilityLabel="Exportar PDF" style={styles.icon} onPress={() => void exportPdf()} disabled={exporting}>{exporting ? <ActivityIndicator color={colors.primary} /> : <Download color={colors.primary} size={19} />}</TouchableOpacity></View></View>
    <Animated.ScrollView
      ref={scrollRef}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onLayout={(event) => { viewportHeight.value = event.nativeEvent.layout.height; }}
      onContentSizeChange={(_, height) => { contentHeight.value = height; }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.detailLinks}><SongLinkButtons links={song} centered /></View>
      <Text style={styles.title}>{song.title}</Text><Text style={styles.artist}>{song.artist.name}</Text>
      <View style={styles.metadata}><Text style={styles.meta}>Tom original: {song.originalKey}</Text>{song.bpm ? <Text style={styles.meta}>{song.bpm} BPM</Text> : null}{song.composer ? <Text style={styles.meta}>Compositor: {song.composer}</Text> : null}</View>
      <View style={styles.controls}>
        <Control label="−1 Tom" onPress={() => chord.transpose(-1)} testID="transpose-down" />
        <TouchableOpacity style={styles.keyControl} onPress={chord.resetTranspose} testID="current-key"><Text style={styles.currentKey}>{chord.currentKey}</Text><Text style={styles.reset}>restaurar</Text></TouchableOpacity>
        <Control label="+1 Tom" onPress={() => chord.transpose(1)} testID="transpose-up" />
      </View>
      <View style={styles.controls}>
        <Control label="A−" onPress={() => chord.changeFontSize(-2)} testID="font-down" />
        <Text style={styles.controlValue}>{chord.fontSize}px</Text>
        <Control label="A+" onPress={() => chord.changeFontSize(2)} testID="font-up" />
        <Control label={`${chord.scrollSpeed.toFixed(2)}×`} onPress={() => chord.changeScrollSpeed(0.25)} testID="scroll-speed" />
        <TouchableOpacity style={[styles.play, autoScrolling && styles.playActive]} onPress={toggleAutoScroll} testID="auto-scroll">{autoScrolling ? <Pause color={colors.surface} size={18} /> : <Play color={colors.surface} size={18} />}<Text style={styles.playText}>{autoScrolling ? "Pausar" : "Rolar"}</Text></TouchableOpacity>
      </View>
      <View style={styles.chordCard}><ChordSheetView content={song.content} originalKey={song.originalKey} semitones={chord.semitoneOffset} fontSize={chord.fontSize} /></View>
    </Animated.ScrollView>
  </SafeAreaView>;
}

function Control({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  return <TouchableOpacity style={styles.control} onPress={onPress} testID={testID}><Text style={styles.controlText}>{label}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, padding: spacing.xl },
  top: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, paddingHorizontal: spacing.xl }, topActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }, icon: { width: 40, height: 40, borderRadius: radii.sm, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  content: { width: "100%", maxWidth: screen.listMaxWidth, alignSelf: "center", padding: spacing.xl, paddingBottom: 160 }, title: { color: colors.ink, fontSize: 30, fontWeight: "800" }, artist: { color: colors.primary, fontSize: 17, fontWeight: "700", marginTop: spacing.xs }, metadata: { marginVertical: spacing.lg, gap: spacing.xs }, meta: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  detailLinks: { alignItems: "center", marginBottom: spacing.xl },
  controls: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md }, control: { minHeight: 40, minWidth: 52, paddingHorizontal: spacing.md, borderRadius: radii.sm, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }, controlText: { color: colors.primary, fontWeight: "800" }, keyControl: { minWidth: 72, alignItems: "center" }, currentKey: { color: colors.ink, fontSize: 22, fontWeight: "900" }, reset: { color: colors.muted, fontSize: 9 }, controlValue: { color: colors.text, fontWeight: "700" },
  play: { minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radii.sm, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", gap: spacing.xs }, playActive: { backgroundColor: colors.danger }, playText: { color: colors.surface, fontWeight: "800" },
  chordCard: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.lg, backgroundColor: colors.surface, padding: spacing.lg }, error: { color: colors.danger, marginBottom: spacing.md },
});
