import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const memoryStorage = new Map<string, string>();

function getWebStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage ?? null;
}

export async function getSessionItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return getWebStorage()?.getItem(key) ?? memoryStorage.get(key) ?? null;
  }

  return SecureStore.getItemAsync(key);
}

export async function setSessionItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    const storage = getWebStorage();
    if (storage) {
      storage.setItem(key, value);
    } else {
      memoryStorage.set(key, value);
    }
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

export async function deleteSessionItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    getWebStorage()?.removeItem(key);
    memoryStorage.delete(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}
