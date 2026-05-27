import { useChurchStore } from "./churchStore";
import { churchService } from "../services/churchService";

jest.mock("../services/churchService", () => ({
  churchService: {
    getMyChurch: jest.fn(),
    updateMyChurch: jest.fn(),
    getChurchOverview: jest.fn(),
  },
}));

const mockedChurchService = churchService as jest.Mocked<typeof churchService>;
const initialState = useChurchStore.getState();

const summary = {
  tenant: {
    id: "tenant-1",
    name: "Igreja Central",
    createdAt: "2026-05-27T00:00:00.000Z",
    updatedAt: "2026-05-27T00:00:00.000Z",
  },
  _count: { users: 2, ministries: 1, schedules: 3, instruments: 10 },
};

describe("churchStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useChurchStore.setState(initialState, true);
  });

  it("carrega resumo da igreja", async () => {
    mockedChurchService.getMyChurch.mockResolvedValueOnce(summary);

    await useChurchStore.getState().loadChurch();

    expect(useChurchStore.getState().summary).toEqual(summary);
    expect(useChurchStore.getState().loading).toBe(false);
    expect(useChurchStore.getState().error).toBeNull();
  });

  it("atualiza nome da igreja", async () => {
    useChurchStore.setState({ summary });
    mockedChurchService.updateMyChurch.mockResolvedValueOnce({
      ...summary,
      tenant: { ...summary.tenant, name: "Nova Igreja" },
    });

    await useChurchStore.getState().updateChurchName("Nova Igreja");

    expect(mockedChurchService.updateMyChurch).toHaveBeenCalledWith({ name: "Nova Igreja" });
    expect(useChurchStore.getState().summary?.tenant.name).toBe("Nova Igreja");
    expect(useChurchStore.getState().saving).toBe(false);
  });

  it("carrega overview", async () => {
    const overview = { tenant: { id: "tenant-1", name: "Igreja Central" }, members: [], ministries: [], instruments: [], schedules: [] };
    mockedChurchService.getChurchOverview.mockResolvedValueOnce(overview);

    await useChurchStore.getState().loadOverview();

    expect(useChurchStore.getState().overview).toEqual(overview);
    expect(useChurchStore.getState().loading).toBe(false);
  });

  it("trata erro preservando estado anterior", async () => {
    useChurchStore.setState({ summary });
    mockedChurchService.getMyChurch.mockRejectedValueOnce(new Error("Falha ao carregar"));

    await useChurchStore.getState().loadChurch();

    expect(useChurchStore.getState().summary).toEqual(summary);
    expect(useChurchStore.getState().error).toBe("Falha ao carregar");
    expect(useChurchStore.getState().loading).toBe(false);
  });

  it("clearError limpa erro", () => {
    useChurchStore.setState({ error: "Erro anterior" });

    useChurchStore.getState().clearError();

    expect(useChurchStore.getState().error).toBeNull();
  });
});
