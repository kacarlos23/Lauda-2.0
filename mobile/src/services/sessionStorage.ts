import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
export { sanitizeUserForSessionStorage } from "../utils/sessionUser";

const memoryStorage = new Map<string, string>();

function getWebStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export async function getSessionItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      const persisted = getWebStorage()?.getItem(key);
      if (persisted !== null && persisted !== undefined) {
        return persisted;
      }
    } catch {
      // Fallback to in-memory storage when localStorage is unavailable or blocked.
    }
    return memoryStorage.get(key) ?? null;
  }

  try {
    const persisted = await SecureStore.getItemAsync(key);
    if (persisted !== null && persisted !== undefined) {
      return persisted;
    }
  } catch {
    // Fallback to in-memory storage when SecureStore fails.
  }
  return memoryStorage.get(key) ?? null;
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
  if (Platform.OS === "web") {
    try {
      getWebStorage()?.removeItem(key);
    } catch {
      // Ignore storage removal failures.
    }
    memoryStorage.delete(key);
    return;
  }

  memoryStorage.delete(key);
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Ignore SecureStore removal failures.
  }
}
