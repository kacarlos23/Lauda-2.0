jest.mock("../services/scheduleService", () => ({
  scheduleService: {
    listSchedules: jest.fn(),
    getMySchedules: jest.fn(),
    createSchedule: jest.fn(),
    updateSchedule: jest.fn(),
    deleteSchedule: jest.fn(),
    updateAssignmentStatus: jest.fn(),
    resolveSubstitution: jest.fn(),
  },
}));

jest.mock("./invalidation", () => ({
  invalidateRelatedData: jest.fn(() => Promise.resolve()),
}));

import type { ScheduleAssignment } from "../types";

const { useScheduleStore } = require("./scheduleStore") as typeof import("./scheduleStore");
const { scheduleService } = require("../services/scheduleService") as typeof import("../services/scheduleService");

const schedule: ScheduleAssignment = {
  id: "assignment-1",
  scheduleId: "schedule-1",
  userId: "user-1",
  role: "Vocal",
  status: "PENDING" as const,
  tenantId: "tenant-1",
  schedule: {
    id: "schedule-1",
    title: "Culto de domingo",
    date: "2099-01-01T12:00:00.000Z",
    ministryId: "ministry-1",
    tenantId: "tenant-1",
    ministry: { id: "ministry-1", name: "Louvor" },
  },
};

describe("scheduleStore", () => {
  beforeEach(() => {
    jest.mocked(scheduleService.listSchedules).mockReset();
    jest.mocked(scheduleService.getMySchedules).mockReset();
    jest.mocked(scheduleService.createSchedule).mockReset();
    jest.mocked(scheduleService.updateSchedule).mockReset();
    jest.mocked(scheduleService.deleteSchedule).mockReset();
    jest.mocked(scheduleService.updateAssignmentStatus).mockReset();
    jest.mocked(scheduleService.resolveSubstitution).mockReset();
    jest.mocked(scheduleService.listSchedules).mockResolvedValue([]);
    jest.mocked(scheduleService.getMySchedules).mockResolvedValue([]);
    jest.mocked(scheduleService.deleteSchedule).mockResolvedValue({ id: "schedule-1" });
    useScheduleStore.setState({
      allSchedules: [],
      schedules: [],
      loading: false,
      schedulesLoading: false,
      mySchedulesLoading: false,
      refreshing: false,
      refreshingRequests: 0,
      saving: false,
      error: null,
      lastFetchedAt: null,
      requestedSchedulesKey: 0,
      requestedMySchedulesKey: 0,
    });
  });

  it("carrega calendário geral de escalas", async () => {
    jest.mocked(scheduleService.listSchedules).mockResolvedValueOnce([schedule.schedule]);

    await useScheduleStore.getState().loadSchedules();

    expect(scheduleService.listSchedules).toHaveBeenCalled();
    expect(useScheduleStore.getState().allSchedules).toEqual([schedule.schedule]);
    expect(useScheduleStore.getState().lastFetchedAt).not.toBeNull();
  });

  it("mantem dados atuais durante refresh paralelo", async () => {
    const updatedSchedule = { ...schedule.schedule, title: "Culto atualizado" };
    const updatedAssignment = { ...schedule, status: "ACCEPTED" as const };
    let resolveSchedules!: (value: Array<typeof schedule.schedule>) => void;
    let resolveMySchedules!: (value: Array<typeof schedule>) => void;
    useScheduleStore.setState({ allSchedules: [schedule.schedule], schedules: [schedule] });
    jest.mocked(scheduleService.listSchedules).mockReturnValueOnce(new Promise((resolve) => { resolveSchedules = resolve; }));
    jest.mocked(scheduleService.getMySchedules).mockReturnValueOnce(new Promise((resolve) => { resolveMySchedules = resolve; }));

    const schedulesPromise = useScheduleStore.getState().loadSchedules({ refresh: true });
    const mySchedulesPromise = useScheduleStore.getState().loadMySchedules({ refresh: true });

    expect(useScheduleStore.getState().allSchedules).toEqual([schedule.schedule]);
    expect(useScheduleStore.getState().schedules).toEqual([schedule]);
    expect(useScheduleStore.getState().loading).toBe(false);

    resolveSchedules([updatedSchedule]);
    await schedulesPromise;
    expect(useScheduleStore.getState().refreshing).toBe(true);

    resolveMySchedules([updatedAssignment]);
    await mySchedulesPromise;

    expect(useScheduleStore.getState().allSchedules[0].title).toBe("Culto atualizado");
    expect(useScheduleStore.getState().schedules[0].status).toBe("ACCEPTED");
    expect(useScheduleStore.getState().refreshing).toBe(false);
  });

  it("cria escala e adiciona na lista geral ordenada", async () => {
    const payload = {
      title: "Culto novo",
      date: "2099-01-02T12:00:00.000Z",
      ministryId: "ministry-1",
      songIds: ["song-1"],
      assignments: [{ userId: "user-1", role: "Vocal" }],
    };
    const created = { ...schedule.schedule, id: "schedule-2", title: payload.title, date: payload.date };
    useScheduleStore.setState({ allSchedules: [schedule.schedule] });
    jest.mocked(scheduleService.createSchedule).mockResolvedValueOnce(created);
    jest.mocked(scheduleService.listSchedules).mockResolvedValueOnce([schedule.schedule, created]);
    jest.mocked(scheduleService.getMySchedules).mockResolvedValueOnce([]);

    await expect(useScheduleStore.getState().createSchedule(payload)).resolves.toEqual(created);

    expect(scheduleService.createSchedule).toHaveBeenCalledWith(payload);
    expect(useScheduleStore.getState().allSchedules.map((item) => item.id)).toEqual(["schedule-1", "schedule-2"]);
  });

  it("atualiza escala na lista geral", async () => {
    const payload = {
      title: "Culto editado",
      date: "2099-01-03T12:00:00.000Z",
      ministryId: "ministry-1",
      songIds: ["song-1"],
      assignments: [{ userId: "user-1", role: "Vocal", status: "PENDING" as const }],
    };
    const updated = { ...schedule.schedule, title: payload.title, date: payload.date };
    useScheduleStore.setState({ allSchedules: [schedule.schedule] });
    jest.mocked(scheduleService.updateSchedule).mockResolvedValueOnce(updated);
    jest.mocked(scheduleService.listSchedules).mockResolvedValueOnce([updated]);
    jest.mocked(scheduleService.getMySchedules).mockResolvedValueOnce([]);

    await expect(useScheduleStore.getState().updateSchedule("schedule-1", payload)).resolves.toEqual(updated);

    expect(scheduleService.updateSchedule).toHaveBeenCalledWith("schedule-1", payload);
    expect(useScheduleStore.getState().allSchedules[0].title).toBe("Culto editado");
  });

  it("exclui escala removendo lista geral e minhas atribuições", async () => {
    useScheduleStore.setState({ allSchedules: [schedule.schedule], schedules: [schedule] });

    await expect(useScheduleStore.getState().deleteSchedule("schedule-1")).resolves.toBeUndefined();

    expect(scheduleService.deleteSchedule).toHaveBeenCalledWith("schedule-1");
    expect(useScheduleStore.getState().allSchedules).toEqual([]);
    expect(useScheduleStore.getState().schedules).toEqual([]);
  });

  it("restaura cache quando exclusão de escala falha", async () => {
    useScheduleStore.setState({ allSchedules: [schedule.schedule], schedules: [schedule] });
    jest.mocked(scheduleService.deleteSchedule).mockRejectedValueOnce(new Error("Falha da API"));

    await expect(useScheduleStore.getState().deleteSchedule("schedule-1")).rejects.toThrow("Falha da API");

    expect(useScheduleStore.getState().allSchedules).toEqual([schedule.schedule]);
    expect(useScheduleStore.getState().schedules).toEqual([schedule]);
    expect(useScheduleStore.getState().error).toBe("Falha da API");
  });

  it("carrega minhas escalas reais", async () => {
    jest.mocked(scheduleService.getMySchedules).mockResolvedValueOnce([schedule]);

    await useScheduleStore.getState().loadMySchedules();

    expect(scheduleService.getMySchedules).toHaveBeenCalled();
    expect(useScheduleStore.getState().schedules).toEqual([schedule]);
  });

  it("aceita escala chamando o service", async () => {
    useScheduleStore.setState({ schedules: [schedule] });
    jest.mocked(scheduleService.updateAssignmentStatus).mockResolvedValueOnce({
      ...schedule,
      status: "ACCEPTED",
    });
    jest.mocked(scheduleService.getMySchedules).mockResolvedValueOnce([{ ...schedule, status: "ACCEPTED" }]);
    jest.mocked(scheduleService.listSchedules).mockResolvedValueOnce([schedule.schedule]);

    await useScheduleStore.getState().updateScheduleStatus("schedule-1", "assignment-1", "ACCEPTED");

    expect(scheduleService.updateAssignmentStatus).toHaveBeenCalledWith("schedule-1", "assignment-1", "ACCEPTED", undefined);
    expect(useScheduleStore.getState().schedules[0].status).toBe("ACCEPTED");
  });

  it("recusa escala chamando o service", async () => {
    useScheduleStore.setState({ schedules: [schedule] });
    jest.mocked(scheduleService.updateAssignmentStatus).mockResolvedValueOnce({
      ...schedule,
      status: "DECLINED",
    });
    jest.mocked(scheduleService.getMySchedules).mockResolvedValueOnce([{ ...schedule, status: "DECLINED" }]);
    jest.mocked(scheduleService.listSchedules).mockResolvedValueOnce([schedule.schedule]);

    await useScheduleStore.getState().updateScheduleStatus("schedule-1", "assignment-1", "DECLINED");

    expect(scheduleService.updateAssignmentStatus).toHaveBeenCalledWith("schedule-1", "assignment-1", "DECLINED", undefined);
    expect(useScheduleStore.getState().schedules[0].status).toBe("DECLINED");
  });

  it("recusa escala com motivo e solicita substituto atualizando o cache local", async () => {
    const scheduleWithAssignment = { ...schedule.schedule, assignments: [schedule] };
    const updated = {
      ...schedule,
      status: "DECLINED" as const,
      declineReason: "Estou viajando",
      substituteRequestedAt: "2026-05-20T10:00:00.000Z",
    };
    useScheduleStore.setState({ schedules: [schedule], allSchedules: [scheduleWithAssignment] });
    jest.mocked(scheduleService.updateAssignmentStatus).mockResolvedValueOnce(updated);
    jest.mocked(scheduleService.getMySchedules).mockResolvedValueOnce([updated]);
    jest.mocked(scheduleService.listSchedules).mockResolvedValueOnce([{ ...scheduleWithAssignment, assignments: [updated] }]);

    await useScheduleStore.getState().updateScheduleStatus("schedule-1", "assignment-1", "DECLINED", {
      declineReason: "Estou viajando",
      requestSubstitute: true,
    });

    expect(scheduleService.updateAssignmentStatus).toHaveBeenCalledWith("schedule-1", "assignment-1", "DECLINED", {
      declineReason: "Estou viajando",
      requestSubstitute: true,
    });
    expect(useScheduleStore.getState().schedules[0]).toMatchObject({
      status: "DECLINED",
      declineReason: "Estou viajando",
      substituteRequestedAt: "2026-05-20T10:00:00.000Z",
    });
    expect(useScheduleStore.getState().allSchedules[0].assignments?.[0]).toMatchObject({
      status: "DECLINED",
      declineReason: "Estou viajando",
    });
  });

  it("resolve solicitaÃ§Ã£o de substituto atualizando o cache local", async () => {
    const pendingSubstitution = {
      ...schedule,
      status: "DECLINED" as const,
      substituteRequestedAt: "2026-05-20T10:00:00.000Z",
      declineReason: "Estou viajando",
    };
    const scheduleWithAssignment = { ...schedule.schedule, assignments: [pendingSubstitution] };
    const updated = {
      ...pendingSubstitution,
      substituteResolvedAt: "2026-05-20T11:00:00.000Z",
      substituteResolvedById: "admin-1",
      substituteResolutionNote: "Resolvido manualmente",
    };
    useScheduleStore.setState({ schedules: [pendingSubstitution], allSchedules: [scheduleWithAssignment] });
    jest.mocked(scheduleService.resolveSubstitution).mockResolvedValueOnce(updated);

    await useScheduleStore.getState().resolveSubstitution("schedule-1", "assignment-1", "Resolvido manualmente");

    expect(scheduleService.resolveSubstitution).toHaveBeenCalledWith("schedule-1", "assignment-1", "Resolvido manualmente");
    expect(useScheduleStore.getState().schedules[0]).toMatchObject({
      substituteResolvedAt: "2026-05-20T11:00:00.000Z",
      substituteResolvedById: "admin-1",
      substituteResolutionNote: "Resolvido manualmente",
    });
    expect(useScheduleStore.getState().allSchedules[0].assignments?.[0]).toMatchObject({
      substituteResolvedAt: "2026-05-20T11:00:00.000Z",
    });
  });
});
