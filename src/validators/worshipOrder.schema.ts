import { z } from "zod";

export const worshipMoments = ["Comunhão", "Louvor", "Ofertório", "Pós-lúdio", "Prelúdio", "Outro"] as const;

export function youtubeUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (!["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}

export const worshipDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((date) => {
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}, "Data inválida");

export const participationSchema = z.object({
  songId: z.string().uuid(),
  moment: z.enum(worshipMoments).default("Louvor"),
  momentDescription: z.string().trim().max(120).nullable().optional(),
  videoUrlOverride: z.string().trim().max(2048).refine((value) => !value || Boolean(youtubeUrl(value)), "Informe um link HTTPS válido do YouTube").nullable().optional(),
});
export const worshipReadingSchema = z.object({
  id: z.string().min(1).max(100),
  text: z.string().min(1).max(12000).refine((value) => Boolean(value.trim()), "Informe a leitura bíblica"),
  position: z.number().int().min(0),
});
export type WorshipReading = z.infer<typeof worshipReadingSchema>;
const periodSchema = z.object({
  scheduleId: z.string().uuid(),
  readings: z.array(worshipReadingSchema).max(100).optional(),
  songs: z.array(participationSchema).refine((songs) => new Set(songs.map((song) => song.songId)).size === songs.length, "Música duplicada na escala"),
}).refine(({ readings = [], songs }) => new Set(readings.map((r) => r.id)).size === readings.length
  && new Set(readings.map((r) => r.position)).size === readings.length
  && readings.every((r) => r.position < songs.length + readings.length), "Posição ou identificação de leitura inválida");
export const worshipOrderSchema = z.object({
  morning: periodSchema.nullable(),
  evening: periodSchema.nullable(),
}).refine((order) => order.morning || order.evening, "Selecione ao menos um período")
  .refine((order) => !order.morning || !order.evening || order.morning.scheduleId !== order.evening.scheduleId, "Selecione escalas diferentes para cada período");

export type WorshipOrderInput = z.infer<typeof worshipOrderSchema>;
