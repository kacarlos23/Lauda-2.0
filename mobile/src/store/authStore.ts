import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { api } from "../services/api";
import { AuthUser } from "../types";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (churchName: string, name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  loadSession: async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      const userJson = await SecureStore.getItemAsync("auth_user");
      if (token && userJson) {
        set({ token, user: JSON.parse(userJson), isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    const response = await api.post("/auth/login", { email, password });
    const { token, user } = response.data.data;
    await SecureStore.setItemAsync("auth_token", token);
    await SecureStore.setItemAsync("auth_user", JSON.stringify(user));
    set({ token, user });
  },

  register: async (churchName, name, email, password) => {
    const response = await api.post("/auth/register", { churchName, name, email, password });
    const { token, user } = response.data.data;
    await SecureStore.setItemAsync("auth_token", token);
    await SecureStore.setItemAsync("auth_user", JSON.stringify(user));
    set({ token, user });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync("auth_token");
    await SecureStore.deleteItemAsync("auth_user");
    set({ user: null, token: null });
  },
}));
