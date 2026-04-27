import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import Constants from "expo-constants";
import { deleteSessionItem, getSessionItem, setSessionItem } from "./sessionStorage";

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

type RefreshResponse = {
  success: boolean;
  data: {
    token: string;
    refreshToken: string;
  };
};

/**
 * In Expo Go (physical device), use the machine's local IP so the phone
 * can reach the backend on the same WiFi network.
 *
 * Options:
 *   - Development (Expo Go):  http://192.168.18.245:3000/api
 *   - Android emulator:       http://10.0.2.2:3000/api
 *   - iOS simulator:          http://localhost:3000/api
 *
 * Expo automatically exposes the dev machine's IP via Constants.expoConfig.hostUri
 * (format: "192.168.x.x:8081"). We extract just the host to build our API URL.
 */
function getBaseUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(":")[0]; // strip Metro port
    return `http://${host}:3000/api`;
  }
  // Fallback for simulators / web
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

let refreshPromise: Promise<string> | null = null;

/**
 * Clears all locally persisted authentication state.
 *
 * @returns A promise that resolves after session keys are removed.
 */
async function clearStoredSession(): Promise<void> {
  await deleteSessionItem("auth_token");
  await deleteSessionItem("refresh_token");
  await deleteSessionItem("auth_user");
}

/**
 * Uses the stored refresh token to request a new access token.
 *
 * @returns The new access token.
 */
export async function refreshAccessToken(): Promise<string> {
  const refreshToken = await getSessionItem("refresh_token");
  if (!refreshToken) {
    throw new Error("Refresh token missing");
  }

  const response = await refreshApi.post<RefreshResponse>("/auth/refresh", {
    refreshToken,
  });

  const { token, refreshToken: nextRefreshToken } = response.data.data;
  await setSessionItem("auth_token", token);
  await setSessionItem("refresh_token", nextRefreshToken);

  // Use require to avoid a static import cycle between api.ts and authStore.ts.
  const { useAuthStore } = require("../store/authStore");
  useAuthStore.setState({ token });

  return token;
}

// Request interceptor: attach JWT token automatically.
api.interceptors.request.use(async (config) => {
  const token = await getSessionItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: refresh once for concurrent 401s, then retry once.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      originalRequest.url?.includes("/auth/refresh")
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      const token = await refreshPromise;
      originalRequest.headers.Authorization = `Bearer ${token}`;

      return api(originalRequest);
    } catch (refreshError) {
      await clearStoredSession();

      const { useAuthStore } = require("../store/authStore");
      useAuthStore.setState({ user: null, token: null, isLoading: false });

      return Promise.reject(refreshError);
    }
  }
);
