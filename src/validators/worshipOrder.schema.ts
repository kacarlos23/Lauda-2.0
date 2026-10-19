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
const periodSchema = z.object({
  scheduleId: z.string().uuid(),
  songs: z.array(participationSchema).refine((songs) => new Set(songs.map((song) => song.songId)).size === songs.length, "Música duplicada na escala"),
});
export const worshipOrderSchema = z.object({
  morning: periodSchema.nullable(),
  evening: periodSchema.nullable(),
}).refine((order) => order.morning || order.evening, "Selecione ao menos um período")
  .refine((order) => !order.morning || !order.evening || order.morning.scheduleId !== order.evening.scheduleId, "Selecione escalas diferentes para cada período");

export type WorshipOrderInput = z.infer<typeof worshipOrderSchema>;
