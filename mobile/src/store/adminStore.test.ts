import { useAdminStore } from "./adminStore";
import { adminService } from "../services/adminService";

jest.mock("../services/adminService", () => ({
  adminService: {
    getTenants: jest.fn(),
  },
}));

const mockedAdminService = adminService as jest.Mocked<typeof adminService>;

const tenants = [
  {
    id: "tenant-1",
    name: "Igreja Central",
    createdAt: "2026-05-27T00:00:00.000Z",
    _count: { users: 2, ministries: 1, schedules: 3, instruments: 10 },
  },
];

describe("adminStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAdminStore.setState({ tenants: [], loading: false, error: null });
  });

  it("loadTenants preenche tenants preservando contagens reais", async () => {
    mockedAdminService.getTenants.mockResolvedValueOnce(tenants);

    await useAdminStore.getState().loadTenants();

    expect(useAdminStore.getState().tenants).toEqual(tenants);
    expect(useAdminStore.getState().tenants[0]._count.users).toBe(2);
    expect(useAdminStore.getState().tenants[0]._count.ministries).toBe(1);
    expect(useAdminStore.getState().tenants[0]._count.instruments).toBe(10);
    expect(useAdminStore.getState().error).toBeNull();
  });

  it("erro seta mensagem e não substitui dados anteriores por zeros fake", async () => {
    useAdminStore.setState({ tenants, loading: false, error: null });
    mockedAdminService.getTenants.mockRejectedValueOnce(new Error("Não foi possível carregar o painel global."));

    await useAdminStore.getState().loadTenants();

    expect(useAdminStore.getState().tenants).toEqual(tenants);
    expect(useAdminStore.getState().tenants[0]._count.users).toBe(2);
    expect(useAdminStore.getState().error).toBe("Não foi possível carregar o painel global.");
    expect(useAdminStore.getState().loading).toBe(false);
  });
});
