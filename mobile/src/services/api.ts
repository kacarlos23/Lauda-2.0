import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { deleteSessionItem, getSessionItem, setSessionItem } from "./sessionStorage";

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

type RefreshResponse = {
  success: boolean;
  data: {
    accessToken?: string;
    token?: string;
    refreshToken: string;
    user?: unknown;
    tenant?: unknown;
  };
};

type QueueItem = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};

const failedQueue: QueueItem[] = [];
let isRefreshing = false;

function getBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) return normalizeApiBaseUrl(envUrl);

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "EXPO_PUBLIC_API_URL is required in production. Refusing to build a frontend that falls back to localhost."
    );
  }

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(":")[0];
    return normalizeApiBaseUrl(`http://${host}:3000/api`);
  }

  if (Platform.OS === "android") {
    return normalizeApiBaseUrl("http://10.0.2.2:3000/api");
  }

  return normalizeApiBaseUrl("http://localhost:3000/api");
}

export function normalizeApiBaseUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

export const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

const refreshApi = axios.create({
  baseURL: getBaseUrl(),
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

function processQueue(error: unknown, token: string | null): void {
  failedQueue.splice(0).forEach((request) => {
    if (error || !token) {
      request.reject(error);
      return;
    }

    request.resolve(token);
  });
}

function isTenantMissingAuthError(error: AxiosError): boolean {
  const data = error.response?.data as { error?: string; message?: string } | undefined;
  const message = data?.error ?? data?.message ?? "";
  return error.response?.status === 401 && message.toLowerCase().includes("tenant ausente");
}

function shouldRetryTenantMissingAuth(error: AxiosError, originalRequest?: RetryableRequestConfig): boolean {
  return Boolean(
    isTenantMissingAuthError(error) &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/refresh") &&
      !originalRequest.url?.includes("/auth/login")
  );
}

async function clearStoredSession(): Promise<void> {
  await deleteSessionItem("auth_token");
  await deleteSessionItem("refresh_token");
  await deleteSessionItem("auth_user");
  await deleteSessionItem("auth_tenant");
}

async function logoutAfterRefreshFailure(): Promise<void> {
  const { useAuthStore } = require("../store/authStore");
  await useAuthStore.getState().logout(false);
}

/**
 * Uses the stored refresh token to request a new access token.
 *
 * @returns The new access token.
 */
export async function refreshAccessToken(): Promise<string> {
  const refreshToken = await getSessionItem("refresh_token");
  if (!refreshToken) {
    throw new Error("Refresh token ausente");
  }

  const response = await refreshApi.post<RefreshResponse>("/auth/refresh", {
    refreshToken,
  });

  const accessToken = response.data.data.accessToken ?? response.data.data.token;
  if (!accessToken) {
    throw new Error("Access token ausente na renovação");
  }

  await setSessionItem("auth_token", accessToken);
  await setSessionItem("refresh_token", response.data.data.refreshToken);
  if (response.data.data.user) {
    await setSessionItem("auth_user", JSON.stringify(response.data.data.user));
  }
  if (response.data.data.tenant) {
    await setSessionItem("auth_tenant", JSON.stringify(response.data.data.tenant));
  }

  const { useAuthStore } = require("../store/authStore");
  useAuthStore.setState({
    accessToken,
    token: accessToken,
    ...(response.data.data.user ? { user: response.data.data.user } : {}),
    ...(response.data.data.tenant ? { tenant: response.data.data.tenant } : {}),
  });

  return accessToken;
}

api.interceptors.request.use(async (config) => {
  const token = await getSessionItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (error.response?.status === 403 && !originalRequest?.url?.includes("/auth/me")) {
      const { useAuthStore } = require("../store/authStore");
      void useAuthStore.getState().refreshCurrentUser();
      return Promise.reject(error);
    }

    if (shouldRetryTenantMissingAuth(error, originalRequest) && originalRequest) {
      originalRequest._retry = true;
      try {
        const token = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch {
        return Promise.reject(error);
      }
    }

    if (isTenantMissingAuthError(error)) {
      return Promise.reject(error);
    }

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      originalRequest.url?.includes("/auth/refresh") ||
      originalRequest.url?.includes("/auth/login")
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    isRefreshing = true;

    try {
      const token = await refreshAccessToken();
      processQueue(null, token);
      originalRequest.headers.Authorization = `Bearer ${token}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      await clearStoredSession();
      await logoutAfterRefreshFailure();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
