import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { getMySchedules, scheduleService, updateAssignmentStatus } from "./scheduleService";
import { api } from "./api";
import { AssignmentStatus, MySchedule } from "../types";

const createMock = jest.fn();
const writeMock = jest.fn();

jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation(() => ({ create: createMock, write: writeMock, uri: "cache/relatorio.pdf" })),
  Paths: { cache: "cache" },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

jest.mock("./api", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
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
      assignments: [{ userId: "user-2", role: "Violão" }],
    };
    const updated = { id: "schedule-1", ...payload, tenantId: "tenant-1" };
    mockedApi.patch.mockResolvedValueOnce({ data: { success: true, data: updated } });

    await expect(scheduleService.updateSchedule("schedule-1", payload)).resolves.toEqual(updated);
    expect(mockedApi.patch).toHaveBeenCalledWith("/schedules/schedule-1", payload);
  });

  it("deleteSchedule chama DELETE /schedules/:id", async () => {
    mockedApi.delete.mockResolvedValueOnce({ data: { success: true, data: { id: "schedule-1", message: "Escala cancelada" } } });

    await expect(scheduleService.deleteSchedule("schedule-1")).resolves.toEqual({ id: "schedule-1", message: "Escala cancelada" });
    expect(mockedApi.delete).toHaveBeenCalledWith("/schedules/schedule-1");
  });

  it("exportScheduleReport baixa PDF da escala e compartilha arquivo", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: new Uint8Array([37, 80, 68, 70]).buffer });

    await expect(scheduleService.exportScheduleReport("schedule-1", "relatorio.pdf")).resolves.toBeUndefined();

    expect(mockedApi.get).toHaveBeenCalledWith("/schedules/schedule-1/report", { responseType: "arraybuffer" });
    expect(createMock).toHaveBeenCalledWith({ overwrite: true });
    expect(writeMock).toHaveBeenCalledWith(new Uint8Array([37, 80, 68, 70]));
  });

  it("exportScheduleReport no web usa os dados da escala sem chamar endpoint /report", async () => {
    const reactNative = jest.requireMock("react-native");
    reactNative.Platform.OS = "web";
    const documentMock = { open: jest.fn(), write: jest.fn(), close: jest.fn() };
    const previousWindow = (globalThis as any).window;
    const openMock = jest.fn().mockReturnValue({ document: documentMock });
    (globalThis as any).window = { open: openMock };

    await expect(scheduleService.exportScheduleReport("schedule-1", "relatorio.pdf", {
      id: "schedule-1",
      title: "Culto relatório",
      date: "2026-07-12T22:30:00.000Z",
      ministryId: "ministry-1",
      tenantId: "tenant-1",
      ministry: { id: "ministry-1", name: "Louvor" },
      songs: [{ id: "ss-1", scheduleId: "schedule-1", songId: "song-1", order: 0, song: { id: "song-1", title: "Senhor Tu És Bom", originalKey: "G", bpm: 96, artistId: "artist-1", artist: { id: "artist-1", name: "Vineyard" } } }],
      assignments: [{ id: "assignment-1", scheduleId: "schedule-1", userId: "user-1", role: "Vocal", status: "ACCEPTED", user: { id: "user-1", name: "Carlos" }, schedule: {} as any }],
    })).resolves.toBeUndefined();

    expect(mockedApi.get).not.toHaveBeenCalled();
    expect(openMock).toHaveBeenCalled();
    expect(documentMock.write.mock.calls[0][0]).toContain("Senhor Tu És Bom");
    expect(documentMock.write.mock.calls[0][0]).toContain("Carlos");
    reactNative.Platform.OS = "ios";
    (globalThis as any).window = previousWindow;
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

  it("updateAssignmentStatus envia motivo e pedido de substituto", async () => {
    const updated = { ...makeSchedule("DECLINED"), declineReason: "Estou viajando", substituteRequestedAt: "2026-05-20T10:00:00.000Z" };
    mockedApi.patch.mockResolvedValueOnce({ data: { success: true, data: updated } });

    await expect(updateAssignmentStatus("schedule-1", "assignment-1", "DECLINED", {
      declineReason: "Estou viajando",
      requestSubstitute: true,
    })).resolves.toEqual(updated);
    expect(mockedApi.patch).toHaveBeenCalledWith(
      "/schedules/schedule-1/assignments/assignment-1/status",
      { status: "DECLINED", declineReason: "Estou viajando", requestSubstitute: true }
    );
  });

  it("resolveSubstitution chama PATCH do endpoint de resoluÃ§Ã£o", async () => {
    const updated = { ...makeSchedule("DECLINED"), substituteResolvedAt: "2026-05-20T11:00:00.000Z" };
    mockedApi.patch.mockResolvedValueOnce({ data: { success: true, data: updated } });

    await expect(scheduleService.resolveSubstitution("schedule-1", "assignment-1", "Resolvido manualmente")).resolves.toEqual(updated);
    expect(mockedApi.patch).toHaveBeenCalledWith(
      "/schedules/schedule-1/assignments/assignment-1/substitution/resolve",
      { note: "Resolvido manualmente" }
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


