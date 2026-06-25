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
  button: { width: 42, height: 42, borderRadius: 21, marginRight: 16, alignItems: "center", justifyContent: "center" },
  image: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceMuted },
  placeholder: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
});
