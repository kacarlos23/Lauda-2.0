import { Text, View } from "react-native";
import { colors, fontSizes, fontWeights, lineHeights } from "../theme";

export function TestEnvironmentBanner() {
  if (process.env.EXPO_PUBLIC_APP_ENV !== "staging") return null;
  return <View testID="test-environment-banner" style={{ height: 22, flexShrink: 0, alignItems: "center", justifyContent: "center", backgroundColor: colors.warningHighlight }}>
    <Text style={{ fontSize: fontSizes.s11, lineHeight: lineHeights.h17, fontWeight: fontWeights.semibold, color: colors.warningTextStrong }}>AMBIENTE DE TESTES · Dados independentes da produção</Text>
  </View>;
}
