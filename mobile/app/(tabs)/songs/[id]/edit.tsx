import { useCallback } from "react";
import { Redirect, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { SongForm } from "../../../../src/components/SongForm";
import { Button, ErrorBanner, LoadingState } from "../../../../src/components/ui";
import { useAuthStore } from "../../../../src/store/authStore";
import { useMusicStore } from "../../../../src/store/musicStore";
import { colors } from "../../../../src/theme";
import { canManageMusic } from "../../../../src/utils/musicPermissions";
import { getSongDetailViewState } from "../../../../src/utils/songDetailState";
import { nav } from "../../../../src/navigation/routes";

export default function EditSongScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const { currentSong, detailLoading, detailError, requestedSongId, saving, error, loadSong, updateSong } = useMusicStore();
  useFocusEffect(useCallback(() => { if (id) void loadSong(id); }, [id, loadSong]));

  if (!canManageMusic(user, "song:edit")) return <Redirect href={nav.songDetail(id)} />;
  const viewState = getSongDetailViewState({ routeSongId: id, currentSong, requestedSongId, detailLoading, detailError });
  if (viewState.status === "loading") return <LoadingState message="Carregando música..." />;
  if (viewState.status === "error") return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["left", "right"]}><ErrorBanner message={viewState.message} action={<Button title="Tentar novamente" variant="secondary" onPress={() => id && loadSong(id)} />} /></SafeAreaView>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["left", "right"]}><SongForm initial={viewState.song} backHref={nav.songDetail(id)} saving={saving} error={error} onSave={async (payload) => (await updateSong(id, payload)).id} /></SafeAreaView>;
}
