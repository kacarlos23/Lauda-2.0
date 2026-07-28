import { useRouter } from "expo-router";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";
import { UserRound } from "lucide-react-native";
import { useAuthStore } from "../store/authStore";
import { colors, controlSizes, iconSizes, radiusValues, spacing } from "../theme";
import { nav } from "../navigation/routes";

export function ProfileHeaderButton() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  return <TouchableOpacity
    style={styles.button}
    onPress={() => router.push(nav.profile)}
    accessibilityRole="button"
    accessibilityLabel="Abrir perfil"
    testID="header-profile-button"
  >
    {user?.avatarUrl
      ? <Image source={{ uri: user.avatarUrl }} style={styles.image} />
      : <View style={styles.placeholder}><UserRound color={colors.primary} size={iconSizes.s20} strokeWidth={2.4} /></View>}
  </TouchableOpacity>;
}

const styles = StyleSheet.create({
  button: { width: controlSizes.default, height: controlSizes.default, borderRadius: radiusValues.r22, marginRight: spacing.lg, alignItems: "center", justifyContent: "center" },
  image: { width: 34, height: 34, borderRadius: radiusValues.r17, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.line },
  placeholder: { width: 34, height: 34, borderRadius: radiusValues.r17, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.lineStrong, alignItems: "center", justifyContent: "center" },
});
