jest.mock("../services/ministryApi", () => ({
  ministryApi: {
    getMinistries: jest.fn(),
    getMinistry: jest.fn(),
    createMinistry: jest.fn(),
    updateMinistry: jest.fn(),
    deleteMinistry: jest.fn(),
    addMember: jest.fn(),
    removeMember: jest.fn(),
  },
}));

import { ministryApi } from "../services/ministryApi";
import { Ministry } from "../types";
import { useMinistryStore } from "./ministryStore";

const mockedApi = ministryApi as jest.Mocked<typeof ministryApi>;
const initialState = useMinistryStore.getState();

const louvor: Ministry = {
  id: "ministry-1",
  name: "Louvor",
  description: null,
  tenantId: "tenant-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  _count: { members: 1 },
};

const recepcao: Ministry = {
  id: "ministry-2",
  name: "Recepção",
  description: null,
  tenantId: "tenant-1",
  createdAt: "2026-01-02T00:00:00.000Z",
  _count: { members: 0 },
};

describe("ministryStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useMinistryStore.setState(initialState, true);
  });

  it("substitui a lista antiga ao recarregar ministérios", async () => {
    useMinistryStore.setState({ ministries: [louvor] });
    mockedApi.getMinistries.mockResolvedValueOnce([recepcao]);

    await useMinistryStore.getState().fetchMinistries();

    expect(useMinistryStore.getState().ministries).toEqual([recepcao]);
    expect(useMinistryStore.getState().loading).toBe(false);
    expect(useMinistryStore.getState().error).toBeNull();
  });

  it("atualiza a lista após criar ministério para evitar tela stale", async () => {
    mockedApi.getMinistries
      .mockResolvedValueOnce([louvor])
      .mockResolvedValueOnce([louvor, recepcao]);
    mockedApi.createMinistry.mockResolvedValueOnce(recepcao);

    await useMinistryStore.getState().fetchMinistries();
    expect(useMinistryStore.getState().ministries).toEqual([louvor]);

    await useMinistryStore.getState().createMinistry({ name: "Recepção" });

    expect(mockedApi.createMinistry).toHaveBeenCalledWith({ name: "Recepção" });
    expect(mockedApi.getMinistries).toHaveBeenCalledTimes(2);
    expect(useMinistryStore.getState().ministries).toEqual([louvor, recepcao]);
  });
});
