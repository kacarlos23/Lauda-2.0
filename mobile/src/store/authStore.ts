import { router } from "expo-router";
import { create } from "zustand";
import { AxiosError } from "axios";
import { api } from "../services/api";
import { deleteSessionItem, getSessionItem, setSessionItem } from "../services/sessionStorage";
import { Role, Tenant, User } from "../types";

type AuthResponse = {
  success: boolean;
  data: {
    accessToken?: string;
    token?: string;
    refreshToken: string;
    user: User;
    tenant: Tenant;
  };
};

type JwtUserPayload = {
  userId?: string;
  id?: string;
  email?: string;
  role?: Role;
  tenantId?: string;
};

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  accessToken: string | null;
  token: string | null;
  loading: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (churchName: string, name: string, email: string, password: string) => Promise<void>;
  memberRegister: (input: {
    inviteCode: string;
    name: string;
    email: string;
    phone?: string;
    password: string;
  }) => Promise<Tenant>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}

function extractAuthError(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { error?: string } | undefined;
    return data?.error ?? "Erro ao autenticar. Tente novamente.";
  }

  return error instanceof Error ? error.message : "Erro ao autenticar. Tente novamente.";
}

function decodeJwtPayload(token: string): JwtUserPayload | null {
  const [, payload] = token.split(".");
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(globalThis.atob(padded)) as JwtUserPayload;
  } catch {
    return null;
  }
}

function userFromToken(token: string): User | null {
  const payload = decodeJwtPayload(token);
  const id = payload?.userId ?? payload?.id;

  if (!id || !payload?.email || !payload.role || !payload.tenantId) {
    return null;
  }

  return {
    id,
    name: payload.email.split("@")[0],
    email: payload.email,
    role: payload.role,
    tenantId: payload.tenantId,
  };
}

async function persistSession(data: AuthResponse["data"]): Promise<string> {
  const accessToken = data.accessToken ?? data.token;
  if (!accessToken) {
    throw new Error("Access token ausente na resposta de autenticação");
  }

  await setSessionItem("auth_token", accessToken);
  await setSessionItem("refresh_token", data.refreshToken);
  await setSessionItem("auth_user", JSON.stringify(data.user));
  await setSessionItem("auth_tenant", JSON.stringify(data.tenant));

  return accessToken;
}

async function clearSession(): Promise<void> {
  await deleteSessionItem("auth_token");
  await deleteSessionItem("refresh_token");
  await deleteSessionItem("auth_user");
  await deleteSessionItem("auth_tenant");
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenant: null,
  accessToken: null,
  token: null,
  loading: false,
  isLoading: true,
  error: null,

  loadSession: async () => {
    set({ loading: true, isLoading: true, error: null });

    try {
      const storedToken = await getSessionItem("auth_token");
      const storedUser = await getSessionItem("auth_user");
      const storedTenant = await getSessionItem("auth_tenant");

      if (!storedToken) {
        set({ user: null, tenant: null, accessToken: null, token: null, loading: false, isLoading: false });
        return;
      }

      const user = storedUser ? (JSON.parse(storedUser) as User) : userFromToken(storedToken);
      const tenant = storedTenant ? (JSON.parse(storedTenant) as Tenant) : null;
      set({
        user,
        tenant,
        accessToken: storedToken,
        token: storedToken,
        loading: false,
        isLoading: false,
      });
    } catch {
      await clearSession();
      set({
        user: null,
        tenant: null,
        accessToken: null,
        token: null,
        loading: false,
        isLoading: false,
        error: "Sessão inválida. Faça login novamente.",
      });
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });

    try {
      const response = await api.post<AuthResponse>("/auth/login", { email, password });
      const accessToken = await persistSession(response.data.data);
      set({
        user: response.data.data.user,
        tenant: response.data.data.tenant,
        accessToken,
        token: accessToken,
        loading: false,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const message = extractAuthError(error);
      set({ loading: false, isLoading: false, error: message });
      throw error;
    }
  },

  register: async (churchName, name, email, password) => {
    set({ loading: true, error: null });

    try {
      const response = await api.post<AuthResponse>("/auth/register", {
        churchName,
        name,
        email,
        password,
      });
      const accessToken = await persistSession(response.data.data);
      set({
        user: response.data.data.user,
        tenant: response.data.data.tenant,
        accessToken,
        token: accessToken,
        loading: false,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const message = extractAuthError(error);
      set({ loading: false, isLoading: false, error: message });
      throw error;
    }
  },

  memberRegister: async (input) => {
    set({ loading: true, error: null });

    try {
      const response = await api.post<AuthResponse>("/auth/member-register", input);
      const accessToken = await persistSession(response.data.data);
      set({
        user: response.data.data.user,
        tenant: response.data.data.tenant,
        accessToken,
        token: accessToken,
        loading: false,
        isLoading: false,
        error: null,
      });
      return response.data.data.tenant;
    } catch (error) {
      const message = extractAuthError(error);
      set({ loading: false, isLoading: false, error: message });
      throw error;
    }
  },

  logout: async () => {
    await clearSession();
    set({
      user: null,
      tenant: null,
      accessToken: null,
      token: null,
      loading: false,
      isLoading: false,
      error: null,
    });
    router.replace("/(auth)/login");
  },
}));
