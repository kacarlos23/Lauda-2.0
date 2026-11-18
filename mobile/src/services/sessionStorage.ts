import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
export { sanitizeUserForSessionStorage } from "../utils/sessionUser";

const memoryStorage = new Map<string, string | null>();

function getWebStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export async function getSessionItem(key: string): Promise<string | null> {
  // A failed write or deletion takes precedence over an older persisted value.
  if (memoryStorage.has(key)) return memoryStorage.get(key) ?? null;

  if (Platform.OS === "web") {
    try {
      return getWebStorage()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setSessionItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    const storage = getWebStorage();
    if (storage) {
      try {
        storage.setItem(key, value);
        memoryStorage.delete(key);
        return;
      } catch {
        // Fallback to in-memory storage on QuotaExceededError or restricted contexts.
      }
    }
    memoryStorage.set(key, value);
    return;
  }

  try {
    await SecureStore.setItemAsync(key, value);
    memoryStorage.delete(key);
  } catch {
    memoryStorage.set(key, value);
  }
}

export async function deleteSessionItem(key: string): Promise<void> {
  memoryStorage.set(key, null);
  if (Platform.OS === "web") {
    const storage = getWebStorage();
    if (!storage) return;
    try {
      storage.removeItem(key);
      memoryStorage.delete(key);
    } catch {
      // Keep the deletion in memory while storage still contains the old item.
    }
    return;
  }

  try {
    await SecureStore.deleteItemAsync(key);
    memoryStorage.delete(key);
  } catch {
    // Keep the deletion in memory while storage still contains the old item.
  }
}
