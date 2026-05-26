import { instrumentService } from "./instrumentService";
import { api } from "./api";

jest.mock("./api", () => ({
  api: {
    delete: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe("instrumentService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("getInstruments chama GET /instruments e retorna data", async () => {
    const instruments = [{ id: "instrument-1", name: "Teclado", colorHex: "#2563EB" }];
    mockedApi.get.mockResolvedValueOnce({ data: { success: true, data: instruments } });

    await expect(instrumentService.getInstruments()).resolves.toEqual(instruments);
    expect(mockedApi.get).toHaveBeenCalledWith("/instruments");
  });

  it("createInstrument chama POST /instruments com payload correto", async () => {
    const payload = { name: "Baixo", colorHex: "#22C55E" };
    const instrument = { id: "instrument-2", ...payload };
    mockedApi.post.mockResolvedValueOnce({ data: { success: true, data: instrument } });

    await expect(instrumentService.createInstrument(payload)).resolves.toEqual(instrument);
    expect(mockedApi.post).toHaveBeenCalledWith("/instruments", payload);
  });

  it("updateInstrument chama PATCH /instruments/:id com payload correto", async () => {
    const payload = { name: "Guitarra", colorHex: "#EF4444" };
    const instrument = { id: "instrument-3", ...payload };
    mockedApi.patch.mockResolvedValueOnce({ data: { success: true, data: instrument } });

    await expect(instrumentService.updateInstrument("instrument-3", payload)).resolves.toEqual(instrument);
    expect(mockedApi.patch).toHaveBeenCalledWith("/instruments/instrument-3", payload);
  });

  it("deleteInstrument chama DELETE /instruments/:id", async () => {
    const instrument = { id: "instrument-4", name: "Vocal", colorHex: null };
    mockedApi.delete.mockResolvedValueOnce({ data: { success: true, data: instrument } });

    await expect(instrumentService.deleteInstrument("instrument-4")).resolves.toEqual(instrument);
    expect(mockedApi.delete).toHaveBeenCalledWith("/instruments/instrument-4");
  });

  it("updateMemberInstruments chama PATCH correto e envia instrumentIds", async () => {
    const response = {
      id: "member-1",
      instruments: [{ id: "instrument-1", name: "Teclado", colorHex: "#2563EB" }],
    };
    mockedApi.patch.mockResolvedValueOnce({ data: { success: true, data: response } });

    await expect(instrumentService.updateMemberInstruments("member-1", ["instrument-1"])).resolves.toEqual(response);
    expect(mockedApi.patch).toHaveBeenCalledWith("/members/member-1/instruments", {
      instrumentIds: ["instrument-1"],
    });
  });

  it("updateMyInstruments usa endpoint do usuário autenticado", async () => {
    const response = {
      id: "member-1",
      instruments: [{ id: "instrument-1", name: "Teclado", colorHex: "#2563EB" }],
    };
    mockedApi.patch.mockResolvedValueOnce({ data: { success: true, data: response } });

    await expect(instrumentService.updateMyInstruments(["instrument-1"])).resolves.toEqual(response);
    expect(mockedApi.patch).toHaveBeenCalledWith("/members/me/instruments", {
      instrumentIds: ["instrument-1"],
    });
  });

  it("converte erro da API em mensagem amigavel", async () => {
    mockedApi.get.mockRejectedValueOnce({
      response: { data: { error: "Instrumento inválido ou não encontrado" } },
    });

    await expect(instrumentService.getInstruments()).rejects.toThrow("Instrumento inválido ou não encontrado");
  });
});
