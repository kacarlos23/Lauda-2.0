import { Redirect, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { SongForm } from "../../../src/components/SongForm";
import { useAuthStore } from "../../../src/store/authStore";
import { useMusicStore } from "../../../src/store/musicStore";
import { canManageMusic } from "../../../src/utils/musicPermissions";
import { colors } from "../../../src/theme";
import { nav } from "../../../src/navigation/routes";

export default function NewSongScreen() {
  const user = useAuthStore((state) => state.user);
  const { saving, error, createSong, clearError } = useMusicStore();
  const [formSession, setFormSession] = useState(0);
  useFocusEffect(useCallback(() => {
    clearError();
    setFormSession((current) => current + 1);
  }, [clearError]));
  if (!canManageMusic(user, "song:create")) return <Redirect href={nav.songs} />;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["left", "right"]}><SongForm key={formSession} backHref={nav.songs} saving={saving} error={error} onSave={async (payload) => (await createSong(payload)).id} /></SafeAreaView>;
}
