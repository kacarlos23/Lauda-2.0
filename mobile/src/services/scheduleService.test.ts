import { getMySchedules, updateAssignmentStatus } from "./scheduleService";
import { api } from "./api";

jest.mock("./api", () => ({
  api: {
    get: jest.fn(),
    patch: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe("scheduleService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("chama GET /schedules/me e retorna as escalas", async () => {
    const schedules = [
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

    mockedApi.get.mockResolvedValueOnce({ data: { success: true, data: schedules } });

    await expect(getMySchedules()).resolves.toEqual(schedules);
    expect(mockedApi.get).toHaveBeenCalledWith("/schedules/me");
  });

  it("chama PATCH com o status informado", async () => {
    const updated = {
      assignmentId: "assignment-1",
      status: "ACCEPTED",
      role: "Vocal",
      schedule: {
        id: "schedule-1",
        title: "Culto de domingo",
        date: "2026-05-24T13:00:00.000Z",
        ministryId: "ministry-1",
        ministry: { id: "ministry-1", name: "Louvor" },
      },
    };

    mockedApi.patch.mockResolvedValueOnce({ data: { success: true, data: updated } });

    await expect(updateAssignmentStatus("schedule-1", "assignment-1", "ACCEPTED")).resolves.toEqual(updated);
    expect(mockedApi.patch).toHaveBeenCalledWith(
      "/schedules/schedule-1/assignments/assignment-1/status",
      { status: "ACCEPTED" }
    );
  });

  it("rejeita status inválido antes de chamar a API", async () => {
    await expect(
      updateAssignmentStatus("schedule-1", "assignment-1", "INVALID" as never)
    ).rejects.toThrow("Status de escala inválido.");
    expect(mockedApi.patch).not.toHaveBeenCalled();
  });
});

