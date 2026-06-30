import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { getMySchedules, scheduleService, updateAssignmentStatus } from "./scheduleService";
import { api } from "./api";
import { AssignmentStatus, MySchedule } from "../types";

jest.mock("./api", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

function makeSchedule(status: AssignmentStatus = "PENDING"): MySchedule {
  return {
    assignmentId: "assignment-1",
    status,
    role: "Vocal",
    schedule: {
      id: "schedule-1",
      title: "Culto de domingo",
      date: "2026-05-24T13:00:00.000Z",
      ministryId: "ministry-1",
      ministry: { id: "ministry-1", name: "Louvor" },
    },
  };
}

function makeAxiosError(data?: { error?: string; message?: string }): AxiosError {
  const config: InternalAxiosRequestConfig = { headers: new AxiosHeaders() };

  return new AxiosError("Request failed", "ERR_BAD_REQUEST", config, {}, {
    config,
    data,
    headers: {},
    status: 400,
    statusText: "Bad Request",
  });
}

describe("scheduleService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("getMySchedules chama GET /schedules/me e retorna response.data.data", async () => {
    const schedules = [makeSchedule()];
    mockedApi.get.mockResolvedValueOnce({ data: { success: true, data: schedules } });

    await expect(getMySchedules()).resolves.toEqual(schedules);
    expect(mockedApi.get).toHaveBeenCalledWith("/schedules/me");
  });

  it("listSchedules chama GET /schedules", async () => {
    const schedules = [{ id: "schedule-1", title: "Culto", date: "2026-05-24T13:00:00.000Z", ministryId: "ministry-1", tenantId: "tenant-1" }];
    mockedApi.get.mockResolvedValueOnce({ data: { success: true, data: schedules } });

    await expect(scheduleService.listSchedules()).resolves.toEqual(schedules);
    expect(mockedApi.get).toHaveBeenCalledWith("/schedules");
  });

  it("createSchedule envia mÃºsicas e membros para POST /schedules", async () => {
    const payload = {
      title: "Culto",
      date: "2026-05-24T13:00:00.000Z",
      ministryId: "ministry-1",
      songIds: ["song-1"],
      assignments: [{ userId: "user-1", role: "Vocal" }],
    };
    const created = { id: "schedule-1", ...payload, tenantId: "tenant-1" };
    mockedApi.post.mockResolvedValueOnce({ data: { success: true, data: created } });

    await expect(scheduleService.createSchedule(payload)).resolves.toEqual(created);
    expect(mockedApi.post).toHaveBeenCalledWith("/schedules", payload);
  });

  it("updateSchedule envia músicas e membros para PATCH /schedules/:id", async () => {
    const payload = {
      title: "Culto atualizado",
      date: "2026-05-25T13:00:00.000Z",
      ministryId: "ministry-1",
      songIds: ["song-2"],
      assignments: [{ userId: "user-2", role: "Violão", status: "PENDING" as const }],
    };
    const updated = { id: "schedule-1", ...payload, tenantId: "tenant-1" };
    mockedApi.patch.mockResolvedValueOnce({ data: { success: true, data: updated } });

    await expect(scheduleService.updateSchedule("schedule-1", payload)).resolves.toEqual(updated);
    expect(mockedApi.patch).toHaveBeenCalledWith("/schedules/schedule-1", payload);
  });
  it("updateAssignmentStatus chama PATCH com ACCEPTED", async () => {
    const updated = makeSchedule("ACCEPTED");
    mockedApi.patch.mockResolvedValueOnce({ data: { success: true, data: updated } });

    await expect(updateAssignmentStatus("schedule-1", "assignment-1", "ACCEPTED")).resolves.toEqual(updated);
    expect(mockedApi.patch).toHaveBeenCalledWith(
      "/schedules/schedule-1/assignments/assignment-1/status",
      { status: "ACCEPTED" }
    );
  });

  it("updateAssignmentStatus aceita DECLINED", async () => {
    const updated = makeSchedule("DECLINED");
    mockedApi.patch.mockResolvedValueOnce({ data: { success: true, data: updated } });

    await expect(updateAssignmentStatus("schedule-1", "assignment-1", "DECLINED")).resolves.toEqual(updated);
    expect(mockedApi.patch).toHaveBeenCalledWith(
      "/schedules/schedule-1/assignments/assignment-1/status",
      { status: "DECLINED" }
    );
  });

  it("status invÃ¡lido lanÃ§a erro antes de chamar a API", async () => {
    await expect(
      updateAssignmentStatus("schedule-1", "assignment-1", "INVALID" as AssignmentStatus)
    ).rejects.toThrow("Status de escala inválido.");
    expect(mockedApi.patch).not.toHaveBeenCalled();
  });

  it("usa mensagem amigavel retornada pela API", async () => {
    mockedApi.get.mockRejectedValueOnce(makeAxiosError({ error: "Escalas indisponÃ­veis." }));

    await expect(getMySchedules()).rejects.toThrow("Escalas indisponÃ­veis.");
  });

  it("usa fallback quando a API nÃ£o retorna mensagem", async () => {
    mockedApi.get.mockRejectedValueOnce(makeAxiosError({}));

    await expect(getMySchedules()).rejects.toThrow("Não foi possível carregar as escalas.");
  });
});


