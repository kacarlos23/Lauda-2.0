import { EventEmitter } from "node:events";
import { lookup } from "node:dns/promises";
import https from "node:https";
import { loadPdfArtistImage, publicImageAddress } from "../../services/pdfArtistImage";
jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }));
jest.mock("node:https", () => ({ get: jest.fn() }));

describe("imagens de artistas no PDF", () => {
  beforeEach(() => { jest.clearAllMocks(); (lookup as jest.Mock).mockResolvedValue([{ address: "8.8.8.8", family: 4 }]); });
  it.each(["127.0.0.1", "10.0.0.1", "169.254.169.254", "192.168.1.1", "100.64.0.1", "::1", "::ffff:127.0.0.1", "fc00::1", "2002:7f00:1::", "invalid"])("bloqueia endereço não público %s", (address) => {
    expect(publicImageAddress(address)).toBe(false);
  });
  it("aceita endereços públicos IPv4 e IPv6", () => {
    expect(publicImageAddress("8.8.8.8")).toBe(true);
    expect(publicImageAddress("2606:4700:4700::1111")).toBe(true);
  });
  it.each(["file:///etc/passwd", "https://user:pass@images.example/photo", "https://images.example:8443/photo", "http://127.0.0.1/photo"])("não acessa URL insegura %s", async (url) => {
    expect(await loadPdfArtistImage(url)).toBeNull(); expect(https.get).not.toHaveBeenCalled();
  });
  it("rejeita DNS privado antes da conexão", async () => {
    (lookup as jest.Mock).mockResolvedValue([{ address: "10.1.2.3", family: 4 }]);
    expect(await loadPdfArtistImage("https://images.example/photo.png")).toBeNull();
    expect(https.get).not.toHaveBeenCalled();
  });
  it.each([200, 302])("usa DNS fixado e não segue redirecionamento HTTP %s", async (status) => {
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    (https.get as jest.Mock).mockImplementation((_url, options, callback) => {
      options.lookup("images.example", {}, (_error: unknown, address: string) => expect(address).toBe("8.8.8.8"));
      const response = Object.assign(new EventEmitter(), { statusCode: status, headers: { "content-type": "image/png" }, destroy: jest.fn() });
      const request = Object.assign(new EventEmitter(), { destroy: jest.fn() });
      queueMicrotask(() => { callback(response); response.emit("data", png); response.emit("end"); });
      return request;
    });
    expect(await loadPdfArtistImage("https://images.example/photo.png")).toEqual(status === 200 ? png : null);
    expect(https.get).toHaveBeenCalledTimes(1);
  });
});
