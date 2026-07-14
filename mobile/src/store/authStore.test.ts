const mockReplace = jest.fn();
const mockStorage = new Map<string, string>();

jest.mock("expo-router", () => ({
  router: { replace: mockReplace },
}));

jest.mock("../services/api", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock("../services/memberService", () => ({
  memberService: {
    getCurrentMember: jest.fn(),
    updateMyProfile: jest.fn(),
  },
}));

jest.mock("./invalidation", () => ({
  invalidateRelatedData: jest.fn(() => Promise.resolve()),
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
const { memberService } = require("../services/memberService") as typeof import("../services/memberService");
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
    jest.mocked(api.get).mockReset();
    jest.mocked(api.post).mockReset();
    jest.mocked(memberService.getCurrentMember).mockReset();
    jest.mocked(memberService.updateMyProfile).mockReset();
    useAuthStore.setState({
      user: null,
      tenant: null,
      accessToken: null,
      token: null,
      loading: false,
      isLoading: true,
      error: null,
    });
    jest.mocked(api.get).mockResolvedValue({ data: { data: { user, tenant, permissions: [] } } });
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
    expect(memberService.updateMyProfile).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user?.instruments).toEqual([
      { id: "instrument-2", name: "Vocal", colorHex: "#10B981" },
    ]);
    expect(JSON.parse(mockStorage.get("auth_user") ?? "{}").instruments).toEqual([
      { id: "instrument-2", name: "Vocal", colorHex: "#10B981" },
    ]);
  });

  it("applyCurrentUser atualiza store e auth_user sem chamar backend", async () => {
    useAuthStore.setState({ user, tenant });

    await useAuthStore.getState().applyCurrentUser({ name: "Ana Local" });

    expect(memberService.updateMyProfile).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user?.name).toBe("Ana Local");
    expect(JSON.parse(mockStorage.get("auth_user") ?? "{}").name).toBe("Ana Local");
  });

  it("refreshCurrentUser busca /auth/me e mantém tenant", async () => {
    useAuthStore.setState({ user, tenant });
    jest.mocked(api.get).mockResolvedValueOnce({
      data: {
        data: {
          user: { ...user, name: "Ana Atualizada", phone: "11999999999", permissions: [] },
          tenant,
          permissions: ["song:create"],
        },
      },
    });

    await useAuthStore.getState().refreshCurrentUser();

    expect(api.get).toHaveBeenCalledWith("/auth/me");
    expect(useAuthStore.getState().tenant).toEqual(tenant);
    expect(useAuthStore.getState().user?.name).toBe("Ana Atualizada");
    expect(useAuthStore.getState().user?.permissions).toEqual(["song:create"]);
    expect(JSON.parse(mockStorage.get("auth_user") ?? "{}").phone).toBe("11999999999");
  });

  it("updateCurrentUser persiste dados de perfil no backend", async () => {
    useAuthStore.setState({ user, tenant });
    jest.mocked(memberService.updateMyProfile).mockResolvedValueOnce({ ...user, name: "Ana Paula", phone: "11999999999", ministries: [] });

    await useAuthStore.getState().updateCurrentUser({ name: "Ana Paula", phone: "11999999999" });

    expect(memberService.updateMyProfile).toHaveBeenCalledWith({
      name: "Ana Paula",
      phone: "11999999999",
      avatarUrl: undefined,
    });
    expect(useAuthStore.getState().user?.name).toBe("Ana Paula");
    expect(JSON.parse(mockStorage.get("auth_user") ?? "{}").name).toBe("Ana Paula");
  });

  it("updateCurrentUser faz rollback se perfil falhar no backend", async () => {
    useAuthStore.setState({ user, tenant });
    jest.mocked(memberService.updateMyProfile).mockRejectedValueOnce(new Error("Falha ao salvar"));

    await expect(useAuthStore.getState().updateCurrentUser({ name: "Nome inválido" })).rejects.toThrow("Falha ao salvar");

    expect(useAuthStore.getState().user).toEqual(user);
    expect(JSON.parse(mockStorage.get("auth_user") ?? "{}").name).toBe(user.name);
  });
});
