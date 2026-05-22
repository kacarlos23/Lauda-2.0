import { instrumentService } from "./instrumentService";
import { api } from "./api";

jest.mock("./api", () => ({
  api: {
    get: jest.fn(),
    patch: jest.fn(),
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

  it("updateMyInstruments usa endpoint do usuario autenticado", async () => {
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
      response: { data: { error: "Instrumento invalido ou nao encontrado" } },
    });

    await expect(instrumentService.getInstruments()).rejects.toThrow("Instrumento invalido ou nao encontrado");
  });
});
