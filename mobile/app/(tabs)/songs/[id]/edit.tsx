import { Redirect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { SongForm } from "../../../../src/components/SongForm";
import { LoadingState } from "../../../../src/components/ui";
import { useAuthStore } from "../../../../src/store/authStore";
import { useMusicStore } from "../../../../src/store/musicStore";
import { colors } from "../../../../src/theme";
import { canManageMusic } from "../../../../src/utils/musicPermissions";
import { useEffect } from "react";

export default function EditSongScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const { currentSong, loading, saving, error, loadSong, updateSong } = useMusicStore();
  useEffect(() => { if (id && currentSong?.id !== id) void loadSong(id); }, [id, currentSong?.id, loadSong]);
  if (!canManageMusic(user, "song:edit")) return <Redirect href={`/(tabs)/songs/${id}` as never} />;
  if (loading || !currentSong || currentSong.id !== id) return <LoadingState message="Carregando música..." />;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["left", "right"]}><SongForm initial={currentSong} backHref={`/songs/${id}`} saving={saving} error={error} onSave={async (payload) => (await updateSong(id, payload)).id} /></SafeAreaView>;
}
