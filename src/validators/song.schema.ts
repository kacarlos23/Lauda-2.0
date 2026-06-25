import { z } from "zod";

export const MUSICAL_KEYS = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
  "Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "A#m", "Bm",
] as const;

export const songIdSchema = z.object({ id: z.string().uuid("ID da música inválido") });

export const songListSchema = z.object({
  search: z.string().trim().max(100).default(""),
  artistId: z.string().uuid("ID do artista inválido").optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createSongSchema = z.object({
  title: z.string().trim().min(1, "O título é obrigatório").max(200),
  artistId: z.string().uuid("ID do artista inválido"),
  composer: z.string().trim().max(200).nullable().optional(),
  originalKey: z.enum(MUSICAL_KEYS, "Tom inválido"),
  content: z.string().min(1, "A cifra é obrigatória").max(100_000, "A cifra deve ter no máximo 100 mil caracteres"),
  bpm: z.number().int().min(30, "O BPM mínimo é 30").max(300, "O BPM máximo é 300").nullable().optional(),
});

export const updateSongSchema = createSongSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  "Informe ao menos um campo para atualizar"
);

export const exportSongsSchema = z.object({
  songIds: z.array(z.string().uuid("ID de música inválido")).min(1).max(50).refine(
    (ids) => new Set(ids).size === ids.length,
    "A seleção não pode conter músicas repetidas"
  ),
});

export type SongListInput = z.infer<typeof songListSchema>;
export type CreateSongInput = z.infer<typeof createSongSchema>;
export type UpdateSongInput = z.infer<typeof updateSongSchema>;
