import { router } from "expo-router";
import { create } from "zustand";
import { AxiosError } from "axios";
import { api } from "../services/api";
import { memberService } from "../services/memberService";
import { deleteSessionItem, getSessionItem, setSessionItem } from "../services/sessionStorage";
import { Role, Tenant, User } from "../types";
import { invalidateRelatedData } from "./invalidation";

type AuthResponse = {
  success: boolean;
  data: {
    accessToken?: string;
    token?: string;
    refreshToken: string;
    user: User;
    tenant?: Tenant;
  };
};

type CurrentUserResponse = {
  success: boolean;
  data: {
    user: User;
    tenant?: Tenant | null;
    permissions?: User["permissions"];
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
  }) => Promise<void>;
  applyCurrentUser: (partialUser: Partial<User>) => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
  updateCurrentUser: (partialUser: Partial<User>) => Promise<void>;
  logout: (revokeServer?: boolean) => Promise<void>;
  logoutAll: () => Promise<void>;
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
  if (data.tenant) {
    await setSessionItem("auth_tenant", JSON.stringify(data.tenant));
  }

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

      const tokenUser = userFromToken(storedToken);
      const storedUserData = storedUser ? (JSON.parse(storedUser) as User) : null;
      const user = storedUserData && tokenUser ? { ...storedUserData, ...tokenUser } : storedUserData ?? tokenUser;
      const tenant = storedTenant ? (JSON.parse(storedTenant) as Tenant) : null;
      set({
        user,
        tenant,
        accessToken: storedToken,
        token: storedToken,
        loading: false,
        isLoading: false,
      });
      await useAuthStore.getState().refreshCurrentUser();
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
        tenant: response.data.data.tenant ?? null,
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
        tenant: response.data.data.tenant ?? null,
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
        tenant: response.data.data.tenant ?? null,
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

  applyCurrentUser: async (partialUser) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;

    const nextUser = { ...currentUser, ...partialUser };
    await setSessionItem("auth_user", JSON.stringify(nextUser));
    set({ user: nextUser, error: null });
    await invalidateRelatedData({ reason: "user", userId: nextUser.id });
  },

  refreshCurrentUser: async () => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;

    try {
      const response = await api.get<CurrentUserResponse>("/auth/me");
      const nextUser = {
        ...currentUser,
        ...response.data.data.user,
        ...(response.data.data.permissions ? { permissions: response.data.data.permissions } : {}),
      };
      await setSessionItem("auth_user", JSON.stringify(nextUser));
      if (response.data.data.tenant) {
        await setSessionItem("auth_tenant", JSON.stringify(response.data.data.tenant));
      }
      set({ user: nextUser, error: null });
      await invalidateRelatedData({ reason: "user", userId: nextUser.id });
    } catch (error) {
      set({ error: extractAuthError(error) });
    }
  },

  updateCurrentUser: async (partialUser) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;

    const previousUser = currentUser;
    const optimisticUser = { ...currentUser, ...partialUser };
    const shouldPersistProfile =
      Object.prototype.hasOwnProperty.call(partialUser, "name") ||
      Object.prototype.hasOwnProperty.call(partialUser, "phone") ||
      Object.prototype.hasOwnProperty.call(partialUser, "avatarUrl");

    await setSessionItem("auth_user", JSON.stringify(optimisticUser));
    set({ user: optimisticUser, error: null });

    if (!shouldPersistProfile) {
      await invalidateRelatedData({ reason: "user", userId: optimisticUser.id });
      return;
    }

    try {
      const updated = await memberService.updateMyProfile({
        name: partialUser.name,
        phone: partialUser.phone,
        avatarUrl: partialUser.avatarUrl,
      });
      const nextUser = { ...optimisticUser, ...updated };
      await setSessionItem("auth_user", JSON.stringify(nextUser));
      set({ user: nextUser, error: null });
      await invalidateRelatedData({ reason: "user", userId: nextUser.id });
    } catch (error) {
      await setSessionItem("auth_user", JSON.stringify(previousUser));
      set({ user: previousUser, error: extractAuthError(error) });
      throw error;
    }
  },

  logout: async (revokeServer = true) => {
    try {
      if (revokeServer) await api.post("/auth/logout");
    } catch {
      // A revoked/expired server session must never prevent local cleanup.
    } finally {
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
    }
  },

  logoutAll: async () => {
    try {
      await api.post("/auth/logout-all");
    } finally {
      await clearSession();
      set({ user: null, tenant: null, accessToken: null, token: null, loading: false, isLoading: false, error: null });
      router.replace("/(auth)/login");
    }
  },
}));
