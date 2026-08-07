jest.mock("react-native", () => ({ Platform: { OS: "web" } }));
jest.mock("expo-constants", () => ({ expoConfig: { hostUri: undefined } }));

import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";

function mockSessionStorage(token: string | null = null) {
  jest.doMock("./sessionStorage", () => ({
    getSessionItem: jest.fn().mockResolvedValue(token),
    setSessionItem: jest.fn(),
    deleteSessionItem: jest.fn(),
  }));
}

function makeAxiosError(status: number, data?: { error?: string; message?: string }): AxiosError {
  const config: InternalAxiosRequestConfig = { headers: new AxiosHeaders(), url: "/admin/songs" };

  return new AxiosError("Request failed", "ERR_BAD_REQUEST", config, {}, {
    config,
    data,
    headers: {},
    status,
    statusText: "Error",
  });
}

describe("api configuration helpers", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.EXPO_PUBLIC_API_URL;
  });

  it("normaliza baseURL para conter /api exatamente uma vez", async () => {
    mockSessionStorage();
    const { normalizeApiBaseUrl } = await import("./api");

    expect(normalizeApiBaseUrl("http://localhost:3000")).toBe("http://localhost:3000/api");
    expect(normalizeApiBaseUrl("http://localhost:3000/api")).toBe("http://localhost:3000/api");
    expect(normalizeApiBaseUrl("http://localhost:3000/api/")).toBe("http://localhost:3000/api");
  });

  it("usa EXPO_PUBLIC_API_URL quando definida", async () => {
    process.env.EXPO_PUBLIC_API_URL = "https://api.example.com/";
    mockSessionStorage();

    const { api } = await import("./api");

    expect(api.defaults.baseURL).toBe("https://api.example.com/api");
  });

  it("troca loopback pelo host do Expo em um dispositivo físico", async () => {
    mockSessionStorage();
    const { resolveApiBaseUrl } = await import("./api");

    expect(resolveApiBaseUrl({
      envUrl: "http://127.0.0.1:3000/api",
      nodeEnv: "development",
      platform: "android",
      expoHostUri: "192.168.18.245:8081",
    })).toBe("http://192.168.18.245:3000/api");
  });

  it("mantém loopback no navegador e usa o host do Expo quando a URL não foi definida", async () => {
    mockSessionStorage();
    const { resolveApiBaseUrl } = await import("./api");

    expect(resolveApiBaseUrl({
      envUrl: "http://localhost:3000/api",
      nodeEnv: "development",
      platform: "web",
      expoHostUri: "192.168.18.245:8081",
    })).toBe("http://localhost:3000/api");
    expect(resolveApiBaseUrl({
      nodeEnv: "development",
      platform: "ios",
      expoHostUri: "exp://192.168.18.245:8081",
    })).toBe("http://192.168.18.245:3000/api");
  });

  it("não inclui fallback local na resolução específica do bundle web", async () => {
    const { resolveApiBaseUrl } = await import("./apiBaseUrl.web");

    expect(() => resolveApiBaseUrl({ envUrl: "" })).toThrow("EXPO_PUBLIC_API_URL is required on web");
    expect(resolveApiBaseUrl({ envUrl: "https://api.example.com" }))
      .toBe("https://api.example.com/api");
  });

  it("falha em producao quando EXPO_PUBLIC_API_URL esta ausente", async () => {
    const mutableEnvironment = process.env as Record<string, string | undefined>;
    const previousNodeEnv = process.env.NODE_ENV;
    mutableEnvironment.NODE_ENV = "production";
    mockSessionStorage();

    try {
      await expect(import("./api")).rejects.toThrow("EXPO_PUBLIC_API_URL is required in production");
    } finally {
      if (previousNodeEnv === undefined) {
        delete mutableEnvironment.NODE_ENV;
      } else {
        mutableEnvironment.NODE_ENV = previousNodeEnv;
      }
    }
  });

  it("interceptor adiciona Authorization quando auth_token existe", async () => {
    mockSessionStorage("token-1");

    const { api } = await import("./api");
    const interceptor = (api.interceptors.request as unknown as { handlers: Array<{ fulfilled: Function }> }).handlers[0]
      .fulfilled;
    const config = await interceptor({ headers: {} });

    expect(config.headers.Authorization).toBe("Bearer token-1");
  });

  it("interceptor não adiciona Authorization quando não há token", async () => {
    mockSessionStorage();

    const { api } = await import("./api");
    const interceptor = (api.interceptors.request as unknown as { handlers: Array<{ fulfilled: Function }> }).handlers[0]
      .fulfilled;
    const config = await interceptor({ headers: {} });

    expect(config.headers.Authorization).toBeUndefined();
  });

  it("não entra em loop quando backend continua rejeitando GLOBAL_ADMIN por tenant ausente", async () => {
    mockSessionStorage("token-1");

    const { api } = await import("./api");
    const interceptor = (api.interceptors.response as unknown as { handlers: Array<{ rejected: Function }> }).handlers[0]
      .rejected;
    const error = makeAxiosError(401, { error: "Tenant ausente no token" });
    (error.config as InternalAxiosRequestConfig & { _retry?: boolean })._retry = true;

    await expect(interceptor(error)).rejects.toBe(error);
  });
});
