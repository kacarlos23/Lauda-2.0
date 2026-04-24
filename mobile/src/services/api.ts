import axios from "axios";
import Constants from "expo-constants";
import { deleteSessionItem, getSessionItem } from "./sessionStorage";

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

// Request interceptor — attach JWT token automatically
api.interceptors.request.use(async (config) => {
  const token = await getSessionItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401 globally
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await deleteSessionItem("auth_token");
    }
    return Promise.reject(error);
  }
);
