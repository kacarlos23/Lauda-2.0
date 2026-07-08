import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { adminService } from "./adminService";
import { api } from "./api";

jest.mock("./api", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

function makeAxiosError(status: number, data?: { error?: string; message?: string }): AxiosError {
  const config: InternalAxiosRequestConfig = { headers: new AxiosHeaders() };

  return new AxiosError("Request failed", "ERR_BAD_REQUEST", config, {}, {
    config,
    data,
    headers: {},
    status,
    statusText: "Error",
  });
}

describe("adminService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("getTenants chama GET /admin/tenants porque a baseURL já contém /api", async () => {
    const tenants = [
      {
        id: "tenant-1",
        name: "Igreja Central",
        createdAt: "2026-05-27T00:00:00.000Z",
        _count: { users: 2, ministries: 1, schedules: 0, instruments: 3 },
      },
    ];
    mockedApi.get.mockResolvedValueOnce({ data: { success: true, data: tenants } });

    await expect(adminService.getTenants()).resolves.toEqual(tenants);
    expect(mockedApi.get).toHaveBeenCalledWith("/admin/tenants");
    expect(mockedApi.get).not.toHaveBeenCalledWith("/api/admin/tenants");
  });

  it("getTenants retorna response.data.data preservando _count real", async () => {
    const tenants = [
      {
        id: "tenant-1",
        name: "Igreja Central",
        createdAt: "2026-01-01T00:00:00.000Z",
        _count: { users: 2, ministries: 1, schedules: 3, instruments: 4 },
      },
    ];
    mockedApi.get.mockResolvedValueOnce({ data: { success: true, data: tenants } });

    const result = await adminService.getTenants();

    expect(result).toEqual(tenants);
    expect(result[0]._count).toEqual({ users: 2, ministries: 1, schedules: 3, instruments: 4 });
  });

  it("getTenantDetails chama GET /admin/tenants/:id", async () => {
    const tenant = {
      id: "tenant-1",
      name: "Igreja Central",
      createdAt: "2026-05-27T00:00:00.000Z",
      _count: { users: 2, ministries: 1, schedules: 0, instruments: 3 },
    };
    mockedApi.get.mockResolvedValueOnce({ data: { success: true, data: tenant } });

    await expect(adminService.getTenantDetails("tenant-1")).resolves.toEqual(tenant);
    expect(mockedApi.get).toHaveBeenCalledWith("/admin/tenants/tenant-1");
  });

  it("getGlobalUsers envia filtro opcional por tenantId", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { success: true, data: [] } });

    await expect(adminService.getGlobalUsers({ tenantId: "tenant-1" })).resolves.toEqual([]);
    expect(mockedApi.get).toHaveBeenCalledWith("/admin/users", { params: { tenantId: "tenant-1" } });
  });

  it("getGlobalMinistries chama GET /admin/ministries", async () => {
    const ministries = [
      {
        id: "ministry-1",
        name: "Louvor",
        tenantId: "tenant-1",
        tenant: { id: "tenant-1", name: "Igreja Central" },
        createdAt: "2026-05-27T00:00:00.000Z",
        _count: { members: 2, schedules: 1 },
      },
    ];
    mockedApi.get.mockResolvedValueOnce({ data: { success: true, data: ministries } });

    await expect(adminService.getGlobalMinistries()).resolves.toEqual(ministries);
    expect(mockedApi.get).toHaveBeenCalledWith("/admin/ministries");
  });

  it("updateTenant chama PATCH /admin/tenants/:id", async () => {
    const tenant = {
      id: "tenant-1",
      name: "Igreja Atualizada",
      domain: "igreja.local",
      createdAt: "2026-05-27T00:00:00.000Z",
      _count: { users: 2, ministries: 1, schedules: 0, instruments: 3 },
    };
    mockedApi.patch.mockResolvedValueOnce({ data: { success: true, data: tenant } });

    await expect(adminService.updateTenant("tenant-1", { name: "Igreja Atualizada" })).resolves.toEqual(tenant);
    expect(mockedApi.patch).toHaveBeenCalledWith("/admin/tenants/tenant-1", { name: "Igreja Atualizada" });
  });

  it("updateUser envia email, senha opcional e tenantId null", async () => {
    const user = {
      id: "user-1",
      name: "Admin Global",
      email: "admin@example.com",
      role: "GLOBAL_ADMIN" as const,
      tenantId: null,
      tenant: null,
      createdAt: "2026-05-27T00:00:00.000Z",
    };
    mockedApi.patch.mockResolvedValueOnce({ data: { success: true, data: user } });

    await expect(adminService.updateUser("user-1", { email: user.email, password: "secret123", tenantId: null })).resolves.toEqual(user);
    expect(mockedApi.patch).toHaveBeenCalledWith("/admin/users/user-1", { email: user.email, password: "secret123", tenantId: null });
  });

  it("lista e edita músicas globais", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { success: true, data: [] } });
    mockedApi.patch.mockResolvedValueOnce({ data: { success: true, data: { id: "song-1", title: "Nova" } } });

    await expect(adminService.getGlobalSongs({ tenantId: "tenant-1" })).resolves.toEqual([]);
    expect(mockedApi.get).toHaveBeenCalledWith("/admin/songs", { params: { tenantId: "tenant-1" } });

    await expect(adminService.updateSong("song-1", { title: "Nova" })).resolves.toEqual({ id: "song-1", title: "Nova" });
    expect(mockedApi.patch).toHaveBeenCalledWith("/admin/songs/song-1", { title: "Nova" });
  });

  it("lista e edita escalas globais", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { success: true, data: [] } });
    mockedApi.patch.mockResolvedValueOnce({ data: { success: true, data: { id: "schedule-1", title: "Culto" } } });

    await expect(adminService.getGlobalSchedules()).resolves.toEqual([]);
    expect(mockedApi.get).toHaveBeenCalledWith("/admin/schedules", { params: undefined });

    await expect(adminService.updateSchedule("schedule-1", { title: "Culto" })).resolves.toEqual({ id: "schedule-1", title: "Culto" });
    expect(mockedApi.patch).toHaveBeenCalledWith("/admin/schedules/schedule-1", { title: "Culto" });
  });

  it("usa endpoints genéricos paginados e ações de ciclo de vida", async () => {
    const page = {
      items: [{ id: "instrument-1", name: "Violão" }],
      pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
    };
    mockedApi.get.mockResolvedValueOnce({ data: { success: true, data: page } });
    mockedApi.post
      .mockResolvedValueOnce({ data: { success: true, data: { id: "instrument-2", name: "Baixo" } } })
      .mockResolvedValueOnce({ data: { success: true, data: { id: "instrument-1", isActive: false } } })
      .mockResolvedValueOnce({ data: { success: true, data: { id: "instrument-1", isActive: true } } });
    mockedApi.delete.mockResolvedValueOnce({ data: { success: true, data: { id: "instrument-1" } } });

    await expect(adminService.getResource("instruments", { search: "violão", page: 1 })).resolves.toEqual(page);
    expect(mockedApi.get).toHaveBeenCalledWith("/admin/instruments", { params: { search: "violão", page: 1 } });

    await expect(adminService.createResource("instruments", { name: "Baixo" })).resolves.toEqual({ id: "instrument-2", name: "Baixo" });
    expect(mockedApi.post).toHaveBeenCalledWith("/admin/instruments", { name: "Baixo" });

    await expect(adminService.deactivateResource("instruments", "instrument-1")).resolves.toEqual({ id: "instrument-1", isActive: false });
    expect(mockedApi.post).toHaveBeenCalledWith("/admin/instruments/instrument-1/deactivate");

    await expect(adminService.activateResource("instruments", "instrument-1")).resolves.toEqual({ id: "instrument-1", isActive: true });
    expect(mockedApi.post).toHaveBeenCalledWith("/admin/instruments/instrument-1/activate");

    await expect(adminService.deleteResource("instruments", "instrument-1")).resolves.toEqual({ id: "instrument-1" });
    expect(mockedApi.delete).toHaveBeenCalledWith("/admin/instruments/instrument-1", { params: { confirm: "permanent" } });
  });

  it("trata erros com mensagem da API", async () => {
    mockedApi.get.mockRejectedValueOnce(makeAxiosError(403, { error: "Acesso negado" }));

    await expect(adminService.getTenants()).rejects.toThrow("Acesso negado");
  });

  it.each([401, 403])("lança erro quando a API retorna %i", async (status) => {
    mockedApi.get.mockRejectedValueOnce(makeAxiosError(status, { error: "Falha autenticada" }));

    await expect(adminService.getTenants()).rejects.toThrow("Falha autenticada");
  });

  it("lança erro amigável quando a API retorna 500", async () => {
    mockedApi.get.mockRejectedValueOnce(makeAxiosError(500));

    await expect(adminService.getTenants()).rejects.toThrow("Não foi possível carregar o painel global.");
  });

  it("não retorna lista vazia nem contadores zerados quando a API falha", async () => {
    mockedApi.get.mockRejectedValueOnce(makeAxiosError(500));

    await expect(adminService.getTenants()).rejects.toThrow("Não foi possível carregar o painel global.");
    expect(mockedApi.get).toHaveBeenCalledTimes(1);
  });
});
