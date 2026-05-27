import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { adminService } from "./adminService";
import { api } from "./api";

jest.mock("./api", () => ({
  api: {
    get: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

function makeAxiosError(data?: { error?: string; message?: string }): AxiosError {
  const config: InternalAxiosRequestConfig = { headers: new AxiosHeaders() };

  return new AxiosError("Request failed", "ERR_BAD_REQUEST", config, {}, {
    config,
    data,
    headers: {},
    status: 400,
    statusText: "Bad Request",
  });
}

describe("adminService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("getTenants chama GET /admin/tenants", async () => {
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

  it("trata erros com mensagem amigavel", async () => {
    mockedApi.get.mockRejectedValueOnce(makeAxiosError({ error: "Acesso negado" }));

    await expect(adminService.getTenants()).rejects.toThrow("Acesso negado");
  });
});
