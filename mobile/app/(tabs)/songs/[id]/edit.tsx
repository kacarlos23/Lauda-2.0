import { ActivityIndicator, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { SongForm } from "../../../../src/components/SongForm";
import { useAuthStore } from "../../../../src/store/authStore";
import { useMusicStore } from "../../../../src/store/musicStore";
import { canManageMusic } from "../../../../src/utils/musicPermissions";
import { colors } from "../../../../src/theme";
import { useEffect } from "react";

export default function EditSongScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const { currentSong, loading, saving, error, loadSong, updateSong } = useMusicStore();
  useEffect(() => { if (id && currentSong?.id !== id) void loadSong(id); }, [id, currentSong?.id, loadSong]);
  if (!canManageMusic(user?.role)) return <Redirect href={`/(tabs)/songs/${id}` as never} />;
  if (loading || !currentSong || currentSong.id !== id) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}><ActivityIndicator color={colors.primary} /></View>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["left", "right"]}><SongForm initial={currentSong} backHref={`/songs/${id}`} saving={saving} error={error} onSave={async (payload) => (await updateSong(id, payload)).id} /></SafeAreaView>;
}
