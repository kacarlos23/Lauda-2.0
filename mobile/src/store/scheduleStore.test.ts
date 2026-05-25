import { useScheduleStore } from "./scheduleStore";
import { getMySchedules, updateAssignmentStatus } from "../services/scheduleService";
import { AssignmentStatus, MySchedule } from "../types";

jest.mock("../services/scheduleService", () => ({
  getMySchedules: jest.fn(),
  updateAssignmentStatus: jest.fn(),
}));

const mockedGetMySchedules = getMySchedules as jest.MockedFunction<typeof getMySchedules>;
const mockedUpdateAssignmentStatus = updateAssignmentStatus as jest.MockedFunction<typeof updateAssignmentStatus>;
const initialState = useScheduleStore.getState();

function makeSchedule(
  assignmentId: string,
  date: string,
  status: AssignmentStatus = "PENDING"
): MySchedule {
  return {
    assignmentId,
    status,
    role: "Vocal",
    schedule: {
      id: `schedule-${assignmentId}`,
      title: `Escala ${assignmentId}`,
      date,
      ministryId: "ministry-1",
      ministry: { id: "ministry-1", name: "Louvor" },
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

describe("scheduleStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useScheduleStore.setState(initialState, true);
  });

  it("tem estado inicial esperado", () => {
    expect(useScheduleStore.getState()).toMatchObject({
      mySchedules: [],
      loading: false,
      refreshing: false,
      error: null,
    });
  });

  it("loadMySchedules seta loading, chama service, ordena escalas e remove loading", async () => {
    const request = deferred<MySchedule[]>();
    const later = makeSchedule("later", "2026-05-24T13:00:00.000Z");
    const next = makeSchedule("next", "2026-05-20T13:00:00.000Z");
    mockedGetMySchedules.mockReturnValueOnce(request.promise);

    const loadPromise = useScheduleStore.getState().loadMySchedules();
    expect(useScheduleStore.getState().loading).toBe(true);

    request.resolve([later, next]);
    await loadPromise;

    expect(mockedGetMySchedules).toHaveBeenCalledTimes(1);
    expect(useScheduleStore.getState().mySchedules).toEqual([next, later]);
    expect(useScheduleStore.getState().loading).toBe(false);
  });

  it("loadMySchedules salva erro e remove loading quando service falha", async () => {
    mockedGetMySchedules.mockRejectedValueOnce(new Error("Falha ao carregar"));

    await useScheduleStore.getState().loadMySchedules();

    expect(useScheduleStore.getState().error).toBe("Falha ao carregar");
    expect(useScheduleStore.getState().loading).toBe(false);
  });

  it("refreshMySchedules seta refreshing, atualiza escalas e remove refreshing", async () => {
    const request = deferred<MySchedule[]>();
    const later = makeSchedule("later", "2026-05-24T13:00:00.000Z");
    const next = makeSchedule("next", "2026-05-20T13:00:00.000Z");
    mockedGetMySchedules.mockReturnValueOnce(request.promise);

    const refreshPromise = useScheduleStore.getState().refreshMySchedules();
    expect(useScheduleStore.getState().refreshing).toBe(true);

    request.resolve([later, next]);
    await refreshPromise;

    expect(useScheduleStore.getState().mySchedules).toEqual([next, later]);
    expect(useScheduleStore.getState().refreshing).toBe(false);
  });

  it("acceptAssignment muda status localmente e chama updateAssignmentStatus com ACCEPTED", async () => {
    const schedule = makeSchedule("assignment-1", "2026-05-20T13:00:00.000Z");
    useScheduleStore.setState({ mySchedules: [schedule] });
    mockedUpdateAssignmentStatus.mockResolvedValueOnce({ ...schedule, status: "ACCEPTED" });

    await useScheduleStore.getState().acceptAssignment("schedule-assignment-1", "assignment-1");

    expect(useScheduleStore.getState().mySchedules[0].status).toBe("ACCEPTED");
    expect(mockedUpdateAssignmentStatus).toHaveBeenCalledWith(
      "schedule-assignment-1",
      "assignment-1",
      "ACCEPTED"
    );
  });

  it("declineAssignment muda status localmente e chama updateAssignmentStatus com DECLINED", async () => {
    const schedule = makeSchedule("assignment-1", "2026-05-20T13:00:00.000Z");
    useScheduleStore.setState({ mySchedules: [schedule] });
    mockedUpdateAssignmentStatus.mockResolvedValueOnce({ ...schedule, status: "DECLINED" });

    await useScheduleStore.getState().declineAssignment("schedule-assignment-1", "assignment-1");

    expect(useScheduleStore.getState().mySchedules[0].status).toBe("DECLINED");
    expect(mockedUpdateAssignmentStatus).toHaveBeenCalledWith(
      "schedule-assignment-1",
      "assignment-1",
      "DECLINED"
    );
  });

  it("faz rollback e salva erro quando acceptAssignment falha", async () => {
    const schedule = makeSchedule("assignment-1", "2026-05-20T13:00:00.000Z", "PENDING");
    useScheduleStore.setState({ mySchedules: [schedule] });
    mockedUpdateAssignmentStatus.mockRejectedValueOnce(new Error("Falha ao aceitar"));

    await useScheduleStore.getState().acceptAssignment("schedule-assignment-1", "assignment-1");

    expect(useScheduleStore.getState().mySchedules).toEqual([schedule]);
    expect(useScheduleStore.getState().error).toBe("Falha ao aceitar");
  });

  it("faz rollback e salva erro quando declineAssignment falha", async () => {
    const schedule = makeSchedule("assignment-1", "2026-05-20T13:00:00.000Z", "PENDING");
    useScheduleStore.setState({ mySchedules: [schedule] });
    mockedUpdateAssignmentStatus.mockRejectedValueOnce(new Error("Falha ao recusar"));

    await useScheduleStore.getState().declineAssignment("schedule-assignment-1", "assignment-1");

    expect(useScheduleStore.getState().mySchedules).toEqual([schedule]);
    expect(useScheduleStore.getState().error).toBe("Falha ao recusar");
  });

  it("clearError limpa erro", () => {
    useScheduleStore.setState({ error: "Erro anterior" });

    useScheduleStore.getState().clearError();

    expect(useScheduleStore.getState().error).toBeNull();
  });
});
