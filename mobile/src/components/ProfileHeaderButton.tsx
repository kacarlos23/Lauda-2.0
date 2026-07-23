import { useRouter } from "expo-router";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";
import { UserRound } from "lucide-react-native";
import { useAuthStore } from "../store/authStore";
import { colors } from "../theme";

export function ProfileHeaderButton() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  return <TouchableOpacity
    style={styles.button}
    onPress={() => router.push("/profile" as never)}
    accessibilityRole="button"
    accessibilityLabel="Abrir perfil"
    testID="header-profile-button"
  >
    {user?.avatarUrl
      ? <Image source={{ uri: user.avatarUrl }} style={styles.image} />
      : <View style={styles.placeholder}><UserRound color={colors.primary} size={20} strokeWidth={2.4} /></View>}
  </TouchableOpacity>;
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: 22, marginRight: 16, alignItems: "center", justifyContent: "center" },
  image: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.line },
  placeholder: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.lineStrong, alignItems: "center", justifyContent: "center" },
});
