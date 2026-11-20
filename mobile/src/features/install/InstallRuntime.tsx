import { useEffect } from "react";
import { useInstallStore } from "./installStore";

export function InstallRuntime() {
  const initialize = useInstallStore((state) => state.initialize);

  useEffect(() => initialize(), [initialize]);

  return null;
}
