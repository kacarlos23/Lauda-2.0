import { Platform } from "react-native";
import * as Sharing from "expo-sharing";
import { api } from "./api";
import { worshipOrderService } from "./worshipOrderService";

const create = jest.fn(), write = jest.fn();
jest.mock("expo-file-system", () => ({ File: jest.fn().mockImplementation(() => ({ create, write, uri: "cache/ordem.pdf" })), Paths: { cache: "cache" } }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn().mockResolvedValue(true), shareAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));
jest.mock("./api", () => ({ api: { get: jest.fn(), put: jest.fn() } }));
const mocked = api as jest.Mocked<typeof api>;

describe("worshipOrderService", () => {
  beforeEach(() => { jest.clearAllMocks(); (Platform as { OS: string }).OS = "ios"; });
  it("carrega e persiste referências explícitas dos períodos", async () => {
    mocked.get.mockResolvedValueOnce({ data: { data: null } });
    expect(await worshipOrderService.get("2026-10-18")).toBeNull();
    const payload = { morning: { scheduleId: "morning", songs: [{ songId: "song", moment: "Ofertório" }] }, evening: null };
    mocked.put.mockResolvedValueOnce({ data: { data: payload } });
    await worshipOrderService.save("2026-10-18", payload);
    expect(mocked.put).toHaveBeenCalledWith("/schedules/worship-order/2026-10-18", payload);
  });
  it.each(["ios", "android"])("compartilha no %s o PDF original retornado pelo backend", async (platform) => {
    (Platform as { OS: string }).OS = platform;
    const bytes = new Uint8Array([37, 80, 68, 70]);
    mocked.get.mockResolvedValueOnce({ data: bytes.buffer });
    await worshipOrderService.exportPdf("2026-10-18");
    expect(mocked.get).toHaveBeenCalledWith("/schedules/worship-order/2026-10-18/pdf", { responseType: "arraybuffer" });
    expect(write).toHaveBeenCalledWith(bytes);
    expect(Sharing.shareAsync).toHaveBeenCalledWith("cache/ordem.pdf", expect.objectContaining({ mimeType: "application/pdf", UTI: "com.adobe.pdf" }));
  });
  it("informa quando o dispositivo não permite compartilhamento", async () => {
    mocked.get.mockResolvedValueOnce({ data: new Uint8Array([37]).buffer });
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);
    await expect(worshipOrderService.exportPdf("2026-10-18")).rejects.toThrow("Compartilhamento indisponível");
  });
});
