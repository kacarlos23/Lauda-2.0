jest.mock("../services/scheduleService", () => ({
  scheduleService: {
    getMySchedules: jest.fn(),
    updateAssignmentStatus: jest.fn(),
  },
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
    jest.mocked(scheduleService.getMySchedules).mockReset();
    jest.mocked(scheduleService.updateAssignmentStatus).mockReset();
    useScheduleStore.setState({ schedules: [], loading: false, error: null });
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
