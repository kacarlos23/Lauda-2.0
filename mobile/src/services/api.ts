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
  };
};

type QueueItem = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};

const failedQueue: QueueItem[] = [];
let isRefreshing = false;

function getBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl;

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(":")[0];
    return `http://${host}:3000/api`;
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:3000/api";
  }

  return "http://localhost:3000/api";
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

async function clearStoredSession(): Promise<void> {
  await deleteSessionItem("auth_token");
  await deleteSessionItem("refresh_token");
  await deleteSessionItem("auth_user");
  await deleteSessionItem("auth_tenant");
}

async function logoutAfterRefreshFailure(): Promise<void> {
  const { useAuthStore } = require("../store/authStore");
  await useAuthStore.getState().logout();
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

  const { useAuthStore } = require("../store/authStore");
  useAuthStore.setState({ accessToken, token: accessToken });

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
