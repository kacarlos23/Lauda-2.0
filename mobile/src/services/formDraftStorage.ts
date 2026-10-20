import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

// Drafts may contain long chord sheets, which exceed SecureStore's value limit.
const file = (key: string) => `${FileSystem.cacheDirectory}form-${encodeURIComponent(key)}.json`;
export async function readFormDraft(key: string): Promise<string | null> {
  if (Platform.OS === "web") return window.localStorage.getItem(key);
  const path = file(key);
  return (await FileSystem.getInfoAsync(path)).exists ? FileSystem.readAsStringAsync(path) : null;
}
export async function writeFormDraft(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") { window.localStorage.setItem(key, value); return; }
  await FileSystem.writeAsStringAsync(file(key), value);
}
export async function removeFormDraft(key: string): Promise<void> {
  if (Platform.OS === "web") { window.localStorage.removeItem(key); return; }
  await FileSystem.deleteAsync(file(key), { idempotent: true });
}
