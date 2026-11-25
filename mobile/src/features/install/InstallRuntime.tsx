import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { useInstallStore } from "./installStore";

export function InstallRuntime() {
  const initialize = useInstallStore((state) => state.initialize);
  const checkForUpdates = useInstallStore((state) => state.checkForUpdates);

  useEffect(() => {
    const cleanup = initialize();
    if (Platform.OS !== "android") {
      return cleanup;
    }

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void checkForUpdates({ force: false });
      }
    });

    return () => {
      cleanup();
      subscription.remove();
    };
  }, [checkForUpdates, initialize]);

  return null;
}
