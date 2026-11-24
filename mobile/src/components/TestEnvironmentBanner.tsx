import { Platform, Text, View } from "react-native";
import { useSafeInsets } from "../hooks/useSafeInsets";
import { colors, fontSizes, fontWeights, lineHeights } from "../theme";

export const isPublicTestEnvironment = process.env.EXPO_PUBLIC_APP_ENV === "staging";

export function TestEnvironmentBanner() {
  const insets = useSafeInsets();
  if (!isPublicTestEnvironment) return null;
  return (
    <View
      style={{
        backgroundColor: colors.warningHighlight,
        paddingTop: Platform.OS !== "web" ? insets.top : 0,
      }}
    >
      <View testID="test-environment-banner" style={{ height: 22, flexShrink: 0, alignItems: "center", justifyContent: "center", backgroundColor: colors.warningHighlight }}>
        <Text style={{ fontSize: fontSizes.s11, lineHeight: lineHeights.h17, fontWeight: fontWeights.semibold, color: colors.warningTextStrong }}>
          AMBIENTE DE TESTES · Dados independentes da produção
        </Text>
      </View>
    </View>
  );
}
