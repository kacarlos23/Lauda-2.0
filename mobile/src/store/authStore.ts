import { create } from "zustand";
import { api } from "../services/api";
import { deleteSessionItem, getSessionItem, setSessionItem } from "../services/sessionStorage";
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
      const token = await getSessionItem("auth_token");
      const userJson = await getSessionItem("auth_user");
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
    const { token, refreshToken, user } = response.data.data;
    await setSessionItem("auth_token", token);
    await setSessionItem("refresh_token", refreshToken);
    await setSessionItem("auth_user", JSON.stringify(user));
    set({ token, user });
  },

  register: async (churchName, name, email, password) => {
    const response = await api.post("/auth/register", { churchName, name, email, password });
    const { token, refreshToken, user } = response.data.data;
    await setSessionItem("auth_token", token);
    await setSessionItem("refresh_token", refreshToken);
    await setSessionItem("auth_user", JSON.stringify(user));
    set({ token, user });
  },

  logout: async () => {
    await deleteSessionItem("auth_token");
    await deleteSessionItem("refresh_token");
    await deleteSessionItem("auth_user");
    set({ user: null, token: null, isLoading: false });
  },
}));
