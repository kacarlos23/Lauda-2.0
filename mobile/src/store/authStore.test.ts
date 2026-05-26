const mockReplace = jest.fn();
const mockStorage = new Map<string, string>();

jest.mock("expo-router", () => ({
  router: { replace: mockReplace },
}));

jest.mock("../services/api", () => ({
  api: {
    post: jest.fn(),
  },
}));

jest.mock("../services/sessionStorage", () => ({
  getSessionItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
  setSessionItem: jest.fn((key: string, value: string) => {
    mockStorage.set(key, value);
    return Promise.resolve();
  }),
  deleteSessionItem: jest.fn((key: string) => {
    mockStorage.delete(key);
    return Promise.resolve();
  }),
}));

const { useAuthStore } = require("./authStore") as typeof import("./authStore");
const { api } = require("../services/api") as typeof import("../services/api");
const { getSessionItem } = require("../services/sessionStorage") as typeof import("../services/sessionStorage");

describe("authStore user instruments", () => {
  beforeEach(() => {
    mockStorage.clear();
    mockReplace.mockClear();
    jest.clearAllMocks();
    useAuthStore.setState({
      user: null,
      tenant: null,
      accessToken: null,
      token: null,
      loading: false,
      isLoading: true,
      error: null,
    });
  });

  it("atualiza instrumentos no usuário atual e persiste auth_user", async () => {
    useAuthStore.setState({
      user: {
        id: "user-1",
        name: "Ana",
        email: "ana@example.com",
        role: "MEMBER",
        tenantId: "tenant-1",
        instruments: [],
      },
    });

    await useAuthStore.getState().updateCurrentUser({
      instruments: [{ id: "instrument-1", name: "Teclado", colorHex: "#2563EB" }],
    });

    expect(useAuthStore.getState().user?.instruments).toEqual([
      { id: "instrument-1", name: "Teclado", colorHex: "#2563EB" },
    ]);
    expect(JSON.parse(mockStorage.get("auth_user") ?? "{}").instruments).toEqual([
      { id: "instrument-1", name: "Teclado", colorHex: "#2563EB" },
    ]);
  });

  it("loadSession restaura instrumentos persistidos", async () => {
    mockStorage.set("auth_token", "token-1");
    mockStorage.set(
      "auth_user",
      JSON.stringify({
        id: "user-1",
        name: "Ana",
        email: "ana@example.com",
        role: "MEMBER",
        tenantId: "tenant-1",
        instruments: [{ id: "instrument-1", name: "Teclado", colorHex: null }],
      })
    );

    await useAuthStore.getState().loadSession();

    expect(getSessionItem).toHaveBeenCalledWith("auth_user");
    expect(useAuthStore.getState().user?.instruments).toEqual([
      { id: "instrument-1", name: "Teclado", colorHex: null },
    ]);
  });

  it("login persiste tenant retornado pela API", async () => {
    (api.post as jest.Mock).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          accessToken: "token-1",
          refreshToken: "refresh-1",
          user: {
            id: "user-1",
            name: "Ana",
            email: "ana@example.com",
            role: "MEMBER",
            tenantId: "tenant-1",
            instruments: [],
          },
          tenant: { id: "tenant-1", name: "Igreja Central" },
        },
      },
    });

    await useAuthStore.getState().login("ana@example.com", "secret");

    expect(JSON.parse(mockStorage.get("auth_tenant") ?? "{}")).toEqual({
      id: "tenant-1",
      name: "Igreja Central",
    });
    expect(useAuthStore.getState().tenant).toEqual({ id: "tenant-1", name: "Igreja Central" });
  });

  it("loadSession restaura tenant persistido", async () => {
    mockStorage.set("auth_token", "token-1");
    mockStorage.set(
      "auth_user",
      JSON.stringify({
        id: "user-1",
        name: "Ana",
        email: "ana@example.com",
        role: "MEMBER",
        tenantId: "tenant-1",
      })
    );
    mockStorage.set("auth_tenant", JSON.stringify({ id: "tenant-1", name: "Igreja Central" }));

    await useAuthStore.getState().loadSession();

    expect(getSessionItem).toHaveBeenCalledWith("auth_tenant");
    expect(useAuthStore.getState().tenant).toEqual({ id: "tenant-1", name: "Igreja Central" });
  });

  it("logout limpa instrumentos com o restante da sessão", async () => {
    mockStorage.set("auth_token", "token-1");
    mockStorage.set("refresh_token", "refresh-1");
    mockStorage.set("auth_user", JSON.stringify({ id: "user-1", instruments: [{ id: "instrument-1" }] }));
    mockStorage.set("auth_tenant", JSON.stringify({ id: "tenant-1", name: "Igreja Central" }));

    await useAuthStore.getState().logout();

    expect(mockStorage.get("auth_token")).toBeUndefined();
    expect(mockStorage.get("refresh_token")).toBeUndefined();
    expect(mockStorage.get("auth_user")).toBeUndefined();
    expect(mockStorage.get("auth_tenant")).toBeUndefined();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().tenant).toBeNull();
  });
});
