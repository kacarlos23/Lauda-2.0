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
  });

  it("normaliza baseURL para conter /api exatamente uma vez", async () => {
    mockSessionStorage();
    const { normalizeApiBaseUrl } = await import("./api");

    expect(normalizeApiBaseUrl("http://localhost:3000")).toBe("http://localhost:3000/api");
    expect(normalizeApiBaseUrl("http://localhost:3000/api")).toBe("http://localhost:3000/api");
    expect(normalizeApiBaseUrl("http://localhost:3000/api/")).toBe("http://localhost:3000/api");
  });

  it("interceptor adiciona Authorization quando auth_token existe", async () => {
    mockSessionStorage("token-1");

    const { api } = await import("./api");
    const interceptor = (api.interceptors.request as never as { handlers: Array<{ fulfilled: Function }> }).handlers[0]
      .fulfilled;
    const config = await interceptor({ headers: {} });

    expect(config.headers.Authorization).toBe("Bearer token-1");
  });

  it("interceptor não adiciona Authorization quando não há token", async () => {
    mockSessionStorage();

    const { api } = await import("./api");
    const interceptor = (api.interceptors.request as never as { handlers: Array<{ fulfilled: Function }> }).handlers[0]
      .fulfilled;
    const config = await interceptor({ headers: {} });

    expect(config.headers.Authorization).toBeUndefined();
  });

  it("não entra em loop quando backend continua rejeitando GLOBAL_ADMIN por tenant ausente", async () => {
    mockSessionStorage("token-1");

    const { api } = await import("./api");
    const interceptor = (api.interceptors.response as never as { handlers: Array<{ rejected: Function }> }).handlers[0]
      .rejected;
    const error = makeAxiosError(401, { error: "Tenant ausente no token" });
    (error.config as InternalAxiosRequestConfig & { _retry?: boolean })._retry = true;

    await expect(interceptor(error)).rejects.toBe(error);
  });
});
