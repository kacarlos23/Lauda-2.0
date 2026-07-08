import { useAdminStore } from "./adminStore";
import { adminService } from "../services/adminService";

jest.mock("../services/adminService", () => ({
  adminService: {
    getTenants: jest.fn(),
    getGlobalUsers: jest.fn(),
    getGlobalMinistries: jest.fn(),
    getGlobalSongs: jest.fn(),
    getGlobalSchedules: jest.fn(),
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

const users = [
  {
    id: "user-1",
    name: "Ana Admin",
    email: "ana@example.com",
    role: "GLOBAL_ADMIN" as const,
    tenantId: null,
    tenant: null,
    createdAt: "2026-05-27T00:00:00.000Z",
  },
];

const ministries = [
  {
    id: "ministry-1",
    name: "Louvor",
    description: "Equipe principal",
    tenantId: "tenant-1",
    tenant: { id: "tenant-1", name: "Igreja Central" },
    createdAt: "2026-05-27T00:00:00.000Z",
    _count: { members: 2, schedules: 3 },
  },
];

const songs = [
  {
    id: "song-1",
    title: "Canção",
    composer: null,
    originalKey: "C" as const,
    content: "[Intro] C",
    bpm: null,
    artistId: "artist-1",
    artist: { id: "artist-1", name: "Artista" },
    tenantId: "tenant-1",
    tenant: { id: "tenant-1", name: "Igreja Central" },
    createdAt: "2026-05-27T00:00:00.000Z",
    updatedAt: "2026-05-27T00:00:00.000Z",
  },
];

const schedules = [
  {
    id: "schedule-1",
    title: "Culto",
    date: "2026-05-27T20:00:00.000Z",
    ministryId: "ministry-1",
    tenantId: "tenant-1",
    tenant: { id: "tenant-1", name: "Igreja Central" },
    ministry: { id: "ministry-1", name: "Louvor" },
    createdAt: "2026-05-27T00:00:00.000Z",
    updatedAt: "2026-05-27T00:00:00.000Z",
    songs: [],
    assignments: [],
  },
];

describe("adminStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAdminStore.setState({ tenants: [], users: [], ministries: [], songs: [], schedules: [], loading: false, error: null });
  });

  it("estado inicial não carrega dados nem erro", () => {
    expect(useAdminStore.getState().tenants).toEqual([]);
    expect(useAdminStore.getState().loading).toBe(false);
    expect(useAdminStore.getState().error).toBeNull();
  });

  it("loadTenants chama o service e preserva contagens reais", async () => {
    mockedAdminService.getTenants.mockResolvedValueOnce(tenants);

    await useAdminStore.getState().loadTenants();

    expect(mockedAdminService.getTenants).toHaveBeenCalledTimes(1);
    expect(useAdminStore.getState().tenants).toEqual(tenants);
    expect(useAdminStore.getState().tenants[0]._count.users).toBe(2);
    expect(useAdminStore.getState().tenants[0]._count.ministries).toBe(1);
    expect(useAdminStore.getState().tenants[0]._count.schedules).toBe(3);
    expect(useAdminStore.getState().tenants[0]._count.instruments).toBe(10);
    expect(useAdminStore.getState().error).toBeNull();
  });

  it("loadDashboard carrega igrejas, usuários, ministérios, músicas e escalas globais", async () => {
    mockedAdminService.getTenants.mockResolvedValueOnce(tenants);
    mockedAdminService.getGlobalUsers.mockResolvedValueOnce(users);
    mockedAdminService.getGlobalMinistries.mockResolvedValueOnce(ministries);
    mockedAdminService.getGlobalSongs.mockResolvedValueOnce(songs);
    mockedAdminService.getGlobalSchedules.mockResolvedValueOnce(schedules);

    await useAdminStore.getState().loadDashboard();

    expect(useAdminStore.getState().tenants).toEqual(tenants);
    expect(useAdminStore.getState().users).toEqual(users);
    expect(useAdminStore.getState().ministries).toEqual(ministries);
    expect(useAdminStore.getState().songs).toEqual(songs);
    expect(useAdminStore.getState().schedules).toEqual(schedules);
    expect(useAdminStore.getState().users[0].tenant).toBeNull();
    expect(useAdminStore.getState().ministries[0]._count?.members).toBe(2);
    expect(useAdminStore.getState().loading).toBe(false);
    expect(useAdminStore.getState().error).toBeNull();
  });

  it("loadTenants preserva dados anteriores quando refresh falha", async () => {
    useAdminStore.setState({ tenants, users: [], ministries: [], songs: [], schedules: [], loading: false, error: null });
    mockedAdminService.getTenants.mockRejectedValueOnce(new Error("Não foi possível carregar igrejas."));

    await useAdminStore.getState().loadTenants();

    expect(useAdminStore.getState().tenants).toEqual(tenants);
    expect(useAdminStore.getState().tenants[0]._count.users).toBe(2);
    expect(useAdminStore.getState().error).toBe("Não foi possível carregar igrejas.");
    expect(useAdminStore.getState().loading).toBe(false);
  });

  it("erro seta mensagem e não substitui dados anteriores por zeros fake", async () => {
    useAdminStore.setState({ tenants, users, ministries, songs, schedules, loading: false, error: null });
    mockedAdminService.getTenants.mockRejectedValueOnce(new Error("Não foi possível carregar o painel global."));

    await useAdminStore.getState().loadDashboard();

    expect(useAdminStore.getState().tenants).toEqual(tenants);
    expect(useAdminStore.getState().users).toEqual(users);
    expect(useAdminStore.getState().ministries).toEqual(ministries);
    expect(useAdminStore.getState().songs).toEqual(songs);
    expect(useAdminStore.getState().schedules).toEqual(schedules);
    expect(useAdminStore.getState().tenants[0]._count.users).toBe(2);
    expect(useAdminStore.getState().error).toBe("Não foi possível carregar o painel global.");
    expect(useAdminStore.getState().loading).toBe(false);
  });
});
