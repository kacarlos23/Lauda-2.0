import { useScheduleStore } from "./scheduleStore";
import { getMySchedules, updateAssignmentStatus } from "../services/scheduleService";
import { MySchedule } from "../types";

jest.mock("../services/scheduleService", () => ({
  getMySchedules: jest.fn(),
  updateAssignmentStatus: jest.fn(),
}));

const mockedGetMySchedules = getMySchedules as jest.MockedFunction<typeof getMySchedules>;
const mockedUpdateAssignmentStatus = updateAssignmentStatus as jest.MockedFunction<typeof updateAssignmentStatus>;

const schedules: MySchedule[] = [
  {
    assignmentId: "assignment-1",
    status: "PENDING",
    role: "Vocal",
    schedule: {
      id: "schedule-1",
      title: "Culto de domingo",
      date: "2026-05-24T13:00:00.000Z",
      ministryId: "ministry-1",
      ministry: { id: "ministry-1", name: "Louvor" },
    },
  },
];

describe("scheduleStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useScheduleStore.setState({
      mySchedules: [],
      loading: false,
      refreshing: false,
      error: null,
    });
  });

  it("loadMySchedules preenche a lista", async () => {
    mockedGetMySchedules.mockResolvedValueOnce(schedules);

    await useScheduleStore.getState().loadMySchedules();

    expect(useScheduleStore.getState().mySchedules).toEqual(schedules);
    expect(useScheduleStore.getState().loading).toBe(false);
  });

  it("acceptAssignment altera status para ACCEPTED", async () => {
    useScheduleStore.setState({ mySchedules: schedules });
    mockedUpdateAssignmentStatus.mockResolvedValueOnce({ ...schedules[0], status: "ACCEPTED" });

    await useScheduleStore.getState().acceptAssignment("schedule-1", "assignment-1");

    expect(useScheduleStore.getState().mySchedules[0].status).toBe("ACCEPTED");
  });

  it("declineAssignment altera status para DECLINED", async () => {
    useScheduleStore.setState({ mySchedules: schedules });
    mockedUpdateAssignmentStatus.mockResolvedValueOnce({ ...schedules[0], status: "DECLINED" });

    await useScheduleStore.getState().declineAssignment("schedule-1", "assignment-1");

    expect(useScheduleStore.getState().mySchedules[0].status).toBe("DECLINED");
  });

  it("salva erro de API ao carregar", async () => {
    mockedGetMySchedules.mockRejectedValueOnce(new Error("Falha ao carregar"));

    await useScheduleStore.getState().loadMySchedules();

    expect(useScheduleStore.getState().error).toBe("Falha ao carregar");
  });

  it("faz rollback quando update falha", async () => {
    useScheduleStore.setState({ mySchedules: schedules });
    mockedUpdateAssignmentStatus.mockRejectedValueOnce(new Error("Falha ao atualizar"));

    await useScheduleStore.getState().acceptAssignment("schedule-1", "assignment-1");

    expect(useScheduleStore.getState().mySchedules[0].status).toBe("PENDING");
    expect(useScheduleStore.getState().error).toBe("Falha ao atualizar");
  });
});

