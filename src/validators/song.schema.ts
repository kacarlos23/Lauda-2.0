import { z } from "zod";

export const createSongSchema = z.object({
  title: z.string().min(1, "O título é obrigatório"),
  artist: z.string().optional(),
  bpm: z.number().int().positive("O BPM deve ser um número positivo").optional(),
});

export type CreateSongInput = z.infer<typeof createSongSchema>;

export const updateSongSchema = createSongSchema.partial();
export type UpdateSongInput = z.infer<typeof updateSongSchema>;
