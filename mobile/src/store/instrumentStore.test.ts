import { useInstrumentStore } from "./instrumentStore";
import { instrumentService } from "../services/instrumentService";
import { Instrument } from "../types";

jest.mock("../services/instrumentService", () => ({
  instrumentService: {
    createInstrument: jest.fn(),
    deleteInstrument: jest.fn(),
    getInstruments: jest.fn(),
    updateInstrument: jest.fn(),
  },
}));

const mockedInstrumentService = instrumentService as jest.Mocked<typeof instrumentService>;
const initialState = useInstrumentStore.getState();

function makeInstrument(id: string, name: string, colorHex: string | null = null): Instrument {
  return { id, name, colorHex };
}

describe("instrumentStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useInstrumentStore.setState(initialState, true);
  });

  it("loadInstruments carrega e ordena por nome", async () => {
    mockedInstrumentService.getInstruments.mockResolvedValueOnce([
      makeInstrument("2", "Vocal"),
      makeInstrument("1", "Baixo"),
    ]);

    await useInstrumentStore.getState().loadInstruments();

    expect(mockedInstrumentService.getInstruments).toHaveBeenCalledTimes(1);
    expect(useInstrumentStore.getState().instruments.map((item) => item.name)).toEqual(["Baixo", "Vocal"]);
    expect(useInstrumentStore.getState().loading).toBe(false);
  });

  it("loadInstruments mantem estado anterior em erro", async () => {
    const previous = [makeInstrument("1", "Baixo")];
    useInstrumentStore.setState({ instruments: previous });
    mockedInstrumentService.getInstruments.mockRejectedValueOnce(new Error("Falha ao carregar"));

    await useInstrumentStore.getState().loadInstruments();

    expect(useInstrumentStore.getState().instruments).toEqual(previous);
    expect(useInstrumentStore.getState().error).toBe("Falha ao carregar");
    expect(useInstrumentStore.getState().loading).toBe(false);
  });

  it("createInstrument insere na lista ordenada", async () => {
    useInstrumentStore.setState({ instruments: [makeInstrument("2", "Vocal")] });
    mockedInstrumentService.createInstrument.mockResolvedValueOnce(makeInstrument("1", "Baixo", "#22C55E"));

    await useInstrumentStore.getState().createInstrument({ name: "Baixo", colorHex: "#22C55E" });

    expect(mockedInstrumentService.createInstrument).toHaveBeenCalledWith({ name: "Baixo", colorHex: "#22C55E" });
    expect(useInstrumentStore.getState().instruments.map((item) => item.name)).toEqual(["Baixo", "Vocal"]);
    expect(useInstrumentStore.getState().saving).toBe(false);
  });

  it("createInstrument mantem estado anterior em erro", async () => {
    const previous = [makeInstrument("2", "Vocal")];
    useInstrumentStore.setState({ instruments: previous });
    mockedInstrumentService.createInstrument.mockRejectedValueOnce(new Error("Nome duplicado"));

    await useInstrumentStore.getState().createInstrument({ name: "Vocal" });

    expect(useInstrumentStore.getState().instruments).toEqual(previous);
    expect(useInstrumentStore.getState().error).toBe("Nome duplicado");
    expect(useInstrumentStore.getState().saving).toBe(false);
  });

  it("updateInstrument atualiza item e ordena lista", async () => {
    useInstrumentStore.setState({ instruments: [makeInstrument("1", "Baixo"), makeInstrument("2", "Vocal")] });
    mockedInstrumentService.updateInstrument.mockResolvedValueOnce(makeInstrument("2", "Acordeon", "#F97316"));

    await useInstrumentStore.getState().updateInstrument("2", { name: "Acordeon", colorHex: "#F97316" });

    expect(mockedInstrumentService.updateInstrument).toHaveBeenCalledWith("2", {
      name: "Acordeon",
      colorHex: "#F97316",
    });
    expect(useInstrumentStore.getState().instruments.map((item) => item.name)).toEqual(["Acordeon", "Baixo"]);
    expect(useInstrumentStore.getState().saving).toBe(false);
  });

  it("updateInstrument mantem estado anterior em erro", async () => {
    const previous = [makeInstrument("1", "Baixo")];
    useInstrumentStore.setState({ instruments: previous });
    mockedInstrumentService.updateInstrument.mockRejectedValueOnce(new Error("Falha ao editar"));

    await useInstrumentStore.getState().updateInstrument("1", { name: "Baixo 2" });

    expect(useInstrumentStore.getState().instruments).toEqual(previous);
    expect(useInstrumentStore.getState().error).toBe("Falha ao editar");
    expect(useInstrumentStore.getState().saving).toBe(false);
  });

  it("deleteInstrument remove item da lista", async () => {
    useInstrumentStore.setState({ instruments: [makeInstrument("1", "Baixo"), makeInstrument("2", "Vocal")] });
    mockedInstrumentService.deleteInstrument.mockResolvedValueOnce(makeInstrument("1", "Baixo"));

    await useInstrumentStore.getState().deleteInstrument("1");

    expect(mockedInstrumentService.deleteInstrument).toHaveBeenCalledWith("1");
    expect(useInstrumentStore.getState().instruments).toEqual([makeInstrument("2", "Vocal")]);
    expect(useInstrumentStore.getState().deletingId).toBeNull();
  });

  it("deleteInstrument mantem item em erro", async () => {
    const previous = [makeInstrument("1", "Baixo")];
    useInstrumentStore.setState({ instruments: previous });
    mockedInstrumentService.deleteInstrument.mockRejectedValueOnce(new Error("Falha ao excluir"));

    await useInstrumentStore.getState().deleteInstrument("1");

    expect(useInstrumentStore.getState().instruments).toEqual(previous);
    expect(useInstrumentStore.getState().error).toBe("Falha ao excluir");
    expect(useInstrumentStore.getState().deletingId).toBeNull();
  });

  it("clearError limpa erro", () => {
    useInstrumentStore.setState({ error: "Erro anterior" });

    useInstrumentStore.getState().clearError();

    expect(useInstrumentStore.getState().error).toBeNull();
  });
});
