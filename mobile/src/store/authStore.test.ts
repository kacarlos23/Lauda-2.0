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

const user = {
  id: "user-1",
  name: "Ana",
  email: "ana@example.com",
  role: "MEMBER" as const,
  tenantId: "tenant-1",
  instruments: [{ id: "instrument-1", name: "Teclado", colorHex: "#2563EB" }],
};

const tenant = { id: "tenant-1", name: "Igreja Central" };

function authResponse(overrides: Partial<typeof user> = {}) {
  return {
    data: {
      data: {
        token: "token-1",
        refreshToken: "refresh-1",
        user: { ...user, ...overrides },
        tenant,
      },
    },
  };
}

describe("authStore session", () => {
  beforeEach(() => {
    mockStorage.clear();
    mockReplace.mockClear();
    jest.mocked(api.post).mockReset();
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
    jest.mocked(api.post).mockResolvedValueOnce(authResponse());

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

    await useAuthStore.getState().login("ana@example.com", "secret123");

    expect(mockStorage.get("auth_tenant")).toBe(JSON.stringify(tenant));
    expect(useAuthStore.getState().tenant).toEqual(tenant);
  });

  it("register persiste tenant", async () => {
    jest.mocked(api.post).mockResolvedValueOnce(authResponse({ name: "Maria" }));

    await useAuthStore.getState().register("Igreja Central", "Maria", "maria@example.com", "secret123");

    expect(mockStorage.get("auth_tenant")).toBe(JSON.stringify(tenant));
    expect(useAuthStore.getState().tenant).toEqual(tenant);
  });

  it("memberRegister persiste tenant", async () => {
    jest.mocked(api.post).mockResolvedValueOnce(authResponse({ name: "Bruno" }));

    await useAuthStore.getState().memberRegister({
      inviteCode: "ABC123",
      name: "Bruno",
      email: "bruno@example.com",
      password: "secret123",
    });

    expect(mockStorage.get("auth_tenant")).toBe(JSON.stringify(tenant));
    expect(useAuthStore.getState().tenant).toEqual(tenant);
  });

  it("loadSession restaura tenant e instrumentos persistidos", async () => {
    mockStorage.set("auth_token", "token-1");
    mockStorage.set("auth_user", JSON.stringify(user));
    mockStorage.set("auth_tenant", JSON.stringify(tenant));

    await useAuthStore.getState().loadSession();

    expect(getSessionItem).toHaveBeenCalledWith("auth_user");
    expect(getSessionItem).toHaveBeenCalledWith("auth_tenant");
    expect(useAuthStore.getState().tenant).toEqual(tenant);
    expect(useAuthStore.getState().user?.instruments).toEqual(user.instruments);
  });

  it("logout limpa instrumentos com o restante da sessão", async () => {
    mockStorage.set("auth_token", "token-1");
    mockStorage.set("refresh_token", "refresh-1");
    mockStorage.set("auth_user", JSON.stringify(user));
    mockStorage.set("auth_tenant", JSON.stringify(tenant));

    await useAuthStore.getState().logout();

    expect(mockStorage.get("auth_token")).toBeUndefined();
    expect(mockStorage.get("refresh_token")).toBeUndefined();
    expect(mockStorage.get("auth_user")).toBeUndefined();
    expect(mockStorage.get("auth_tenant")).toBeUndefined();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().tenant).toBeNull();
  });

  it("updateCurrentUser preserva tenant e instrumentos", async () => {
    useAuthStore.setState({ user: { ...user, instruments: [] }, tenant });

    await useAuthStore.getState().updateCurrentUser({
      instruments: [{ id: "instrument-2", name: "Vocal", colorHex: "#10B981" }],
    });

    expect(useAuthStore.getState().tenant).toEqual(tenant);
    expect(useAuthStore.getState().user?.instruments).toEqual([
      { id: "instrument-2", name: "Vocal", colorHex: "#10B981" },
    ]);
    expect(JSON.parse(mockStorage.get("auth_user") ?? "{}").instruments).toEqual([
      { id: "instrument-2", name: "Vocal", colorHex: "#10B981" },
    ]);
  });
});
