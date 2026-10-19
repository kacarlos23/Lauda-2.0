import { WorshipOrderPdfService, WorshipPdfData } from "../../services/worshipOrderPdfService";
import { worshipDateSchema, worshipOrderSchema, youtubeUrl } from "../../validators/worshipOrder.schema";
import { createScheduleSchema } from "../../validators/schedule.validator";
import { readFileSync } from "node:fs";
import path from "node:path";
import * as artistImages from "../../services/pdfArtistImage";

const scheduleId = "123e4567-e89b-42d3-a456-426614174000";
const songId = "123e4567-e89b-42d3-a456-426614174001";
const song = (index: number, video = true) => ({
  order: index, moment: "Ofertório", song: { title: `${index + 1} - Grandioso És Tu`, artist: { name: "Paulo César Baruk, Leandro Rodrigues e Preto no Branco" }, videoUrl: video ? `https://www.youtube.com/watch?v=video${index}` : null },
});
describe("Ordem de Culto", () => {
  afterEach(() => jest.restoreAllMocks());
  it.each([true, false])("incorpora foto válida e tolera imagem corrompida (%s)", async (valid) => {
    const bytes = valid ? readFileSync(path.resolve("mobile/assets/brand/png/lauda-symbol-512.png")) : Buffer.from("broken-image");
    jest.spyOn(artistImages, "loadPdfArtistImages").mockResolvedValue(new Map([["https://images.example/artist.png", bytes]]));
    const entry = { ...song(0), song: { ...song(0).song, artist: { name: "Artista cadastrado", imageUrl: "https://images.example/artist.png" } } };
    const raw = (await new WorshipOrderPdfService().generate({ date: "2026-10-18", morning: { songs: [entry] } })).toString("latin1");
    expect(raw.startsWith("%PDF")).toBe(true);
    expect(raw.match(/\/Subtype \/Image/g)!.length).toBeGreaterThanOrEqual(valid ? 4 : 2);
  });
  it("valida os metadados no cadastro da escala e exige correspondência com o repertório", () => {
    const input = { title: "Culto", date: "2026-10-18T12:00:00Z", ministryId: scheduleId, songIds: [songId], songDetails: [{ songId, moment: "Ofertório" }], worshipPeriod: "MORNING" };
    expect(createScheduleSchema.safeParse(input).success).toBe(true);
    expect(createScheduleSchema.safeParse({ ...input, songDetails: [{ songId: scheduleId, moment: "Louvor" }] }).success).toBe(false);
    expect(createScheduleSchema.safeParse({ ...input, songDetails: [...input.songDetails, ...input.songDetails] }).success).toBe(false);
    expect(createScheduleSchema.safeParse({ ...input, songDetails: [{ songId, moment: "Louvor", videoUrlOverride: "javascript:alert(1)" }] }).success).toBe(false);
  });
  it.each(["2026-02-30", "2026-13-01", "18/10/2026", "2026-01-00"])("rejeita data inválida %s", (date) => {
    expect(worshipDateSchema.safeParse(date).success).toBe(false);
  });
  it("aceita data civil sem conversão de fuso e aplica Louvor por padrão", () => {
    expect(worshipDateSchema.parse("2026-10-18")).toBe("2026-10-18");
    expect(worshipOrderSchema.parse({ morning: { scheduleId, songs: [{ songId }] }, evening: null }).morning?.songs[0]?.moment).toBe("Louvor");
  });
  it.each(["javascript:alert(1)", "http://youtube.com/watch?v=x", "https://youtube.com.evil.test/x", "https://evil.test/x", "https://user:pass@youtube.com/x"])("rejeita URL %s", (url) => {
    expect(youtubeUrl(url)).toBeNull();
    expect(worshipOrderSchema.safeParse({ morning: { scheduleId, songs: [{ songId, videoUrlOverride: url }] }, evening: null }).success).toBe(false);
  });
  it("rejeita períodos ausentes, escala repetida e músicas duplicadas", () => {
    const period = { scheduleId, songs: [{ songId }] };
    expect(worshipOrderSchema.safeParse({ morning: null, evening: null }).success).toBe(false);
    expect(worshipOrderSchema.safeParse({ morning: period, evening: period }).success).toBe(false);
    expect(worshipOrderSchema.safeParse({ morning: { scheduleId, songs: [{ songId }, { songId }] }, evening: null }).success).toBe(false);
  });
  it.each(["morning", "evening", "both"])("gera PDF %s com hyperlinks reais e ignora vídeo inseguro", async (period) => {
    const songs = [song(0), song(1, false), { ...song(2), song: { ...song(2).song, videoUrl: "javascript:alert(1)" } }];
    const data: WorshipPdfData = { date: "2026-10-18", morning: period !== "evening" ? { songs } : null, evening: period !== "morning" ? { songs } : null };
    const pdf = await new WorshipOrderPdfService().generate(data);
    const raw = pdf.toString("latin1");
    expect(raw.startsWith("%PDF")).toBe(true);
    expect(raw.match(/\/Subtype \/Link/g)).toHaveLength(period === "both" ? 4 : 2);
    expect(raw).toContain("/URI (https://www.youtube.com/watch?v=video0)");
    expect(raw).not.toContain("javascript:");
    expect(raw.match(/\/Type \/Page\b/g)).toHaveLength(1);
  });
  it("usa o vídeo do cadastro mesmo com override histórico e pagina títulos e artistas longos", async () => {
    const songs = Array.from({ length: 32 }, (_, i) => ({ ...song(i), videoUrlOverride: "https://youtu.be/override", moment: "Outro", momentDescription: "Momento de celebração e agradecimento", song: { ...song(i).song, title: "526 - " + "Grandioso És Tu ".repeat(10) } }));
    const raw = (await new WorshipOrderPdfService().generate({ date: "2026-10-18", morning: { songs } })).toString("latin1");
    expect(raw.match(/\/Type \/Page\b/g)!.length).toBeGreaterThan(1);
    expect(raw.match(/\/Subtype \/Link/g)!.length).toBeGreaterThanOrEqual(64);
    expect(raw).toContain("watch?v=video");
    expect(raw).not.toContain("https://youtu.be/override");
  });
  it("omite vídeo quando apenas a participação histórica tem link", async () => {
    const entry = { ...song(0, false), videoUrlOverride: "https://youtu.be/override" };
    const raw = (await new WorshipOrderPdfService().generate({ date: "2026-10-21", evening: { songs: [entry] } })).toString("latin1");
    expect(raw).not.toContain("/Subtype /Link");
  });
});
