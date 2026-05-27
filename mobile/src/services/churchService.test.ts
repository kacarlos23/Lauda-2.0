import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { churchService } from "./churchService";
import { api } from "./api";

jest.mock("./api", () => ({
  api: {
    get: jest.fn(),
    patch: jest.fn(),
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

const summary = {
  tenant: {
    id: "tenant-1",
    name: "Igreja Central",
    createdAt: "2026-05-27T00:00:00.000Z",
    updatedAt: "2026-05-27T00:00:00.000Z",
  },
  _count: { users: 2, ministries: 1, schedules: 3, instruments: 10 },
};

describe("churchService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("getMyChurch chama GET /church/me", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { success: true, data: summary } });

    await expect(churchService.getMyChurch()).resolves.toEqual(summary);
    expect(mockedApi.get).toHaveBeenCalledWith("/church/me");
  });

  it("updateMyChurch chama PATCH /church/me", async () => {
    mockedApi.patch.mockResolvedValueOnce({
      data: { success: true, data: { ...summary, tenant: { ...summary.tenant, name: "Nova Igreja" } } },
    });

    await expect(churchService.updateMyChurch({ name: "Nova Igreja" })).resolves.toMatchObject({
      tenant: { name: "Nova Igreja" },
    });
    expect(mockedApi.patch).toHaveBeenCalledWith("/church/me", { name: "Nova Igreja" });
  });

  it("getChurchOverview chama GET /church/overview", async () => {
    const overview = { tenant: { id: "tenant-1", name: "Igreja Central" }, members: [], ministries: [], instruments: [], schedules: [] };
    mockedApi.get.mockResolvedValueOnce({ data: { success: true, data: overview } });

    await expect(churchService.getChurchOverview()).resolves.toEqual(overview);
    expect(mockedApi.get).toHaveBeenCalledWith("/church/overview");
  });

  it("lança erro quando API falha", async () => {
    mockedApi.get.mockRejectedValueOnce(makeAxiosError({ error: "Acesso negado" }));

    await expect(churchService.getMyChurch()).rejects.toThrow("Acesso negado");
  });
});
