jest.mock("../services/scheduleService", () => ({
  scheduleService: {
    listSchedules: jest.fn(),
    getMySchedules: jest.fn(),
    createSchedule: jest.fn(),
    updateSchedule: jest.fn(),
    updateAssignmentStatus: jest.fn(),
  },
}));

jest.mock("./invalidation", () => ({
  invalidateRelatedData: jest.fn(() => Promise.resolve()),
}));

const { useScheduleStore } = require("./scheduleStore") as typeof import("./scheduleStore");
const { scheduleService } = require("../services/scheduleService") as typeof import("../services/scheduleService");

const schedule = {
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
    jest.mocked(scheduleService.updateAssignmentStatus).mockReset();
    useScheduleStore.setState({ allSchedules: [], schedules: [], loading: false, saving: false, error: null });
  });

  it("carrega calendário geral de escalas", async () => {
    jest.mocked(scheduleService.listSchedules).mockResolvedValueOnce([schedule.schedule]);

    await useScheduleStore.getState().loadSchedules();

    expect(scheduleService.listSchedules).toHaveBeenCalled();
    expect(useScheduleStore.getState().allSchedules).toEqual([schedule.schedule]);
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

    await expect(useScheduleStore.getState().updateSchedule("schedule-1", payload)).resolves.toEqual(updated);

    expect(scheduleService.updateSchedule).toHaveBeenCalledWith("schedule-1", payload);
    expect(useScheduleStore.getState().allSchedules[0].title).toBe("Culto editado");
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

    await useScheduleStore.getState().updateScheduleStatus("schedule-1", "assignment-1", "ACCEPTED");

    expect(scheduleService.updateAssignmentStatus).toHaveBeenCalledWith("schedule-1", "assignment-1", "ACCEPTED");
    expect(useScheduleStore.getState().schedules[0].status).toBe("ACCEPTED");
  });

  it("recusa escala chamando o service", async () => {
    useScheduleStore.setState({ schedules: [schedule] });
    jest.mocked(scheduleService.updateAssignmentStatus).mockResolvedValueOnce({
      ...schedule,
      status: "DECLINED",
    });

    await useScheduleStore.getState().updateScheduleStatus("schedule-1", "assignment-1", "DECLINED");

    expect(scheduleService.updateAssignmentStatus).toHaveBeenCalledWith("schedule-1", "assignment-1", "DECLINED");
    expect(useScheduleStore.getState().schedules[0].status).toBe("DECLINED");
  });
});
