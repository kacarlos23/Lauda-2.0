import { z } from "zod";
import { MUSICAL_KEYS } from "./song.schema";

const optionalHttpUrl = z.preprocess(
  (value) => typeof value === "string" ? value.trim() || null : value,
  z.string()
    .url("Link da cifra inválido")
    .refine((value) => value.startsWith("http://") || value.startsWith("https://"), "O link deve começar com http:// ou https://")
    .nullable()
    .optional(),
);

export const portableSongSchema = z.object({
  title: z.string().trim().min(1, "O nome da música é obrigatório").max(200),
  artist: z.string().trim().min(1, "O artista é obrigatório").max(200),
  originalKey: z.enum(MUSICAL_KEYS, "Tom inválido"),
  content: z.string().min(1, "A cifra é obrigatória").max(100_000, "A cifra deve ter no máximo 100 mil caracteres"),
  cifraUrl: optionalHttpUrl,
}).strict();

export const songTransferDocumentSchema = z.object({
  format: z.literal("lauda.music-catalog"),
  version: z.literal(1),
  songs: z.array(portableSongSchema).min(1, "O arquivo não contém músicas").max(2_000, "O arquivo excede o limite de 2.000 músicas"),
}).strict();

export const songTransferExportSchema = z.object({
  ministryId: z.string().uuid("ID do ministério inválido"),
  songIds: z.array(z.string().uuid("ID de música inválido")).max(2_000).refine(
    (ids) => new Set(ids).size === ids.length,
    "A seleção não pode conter músicas repetidas",
  ).optional(),
}).strict();

export const songTransferPreviewSchema = z.object({
  ministryId: z.string().uuid("ID do ministério inválido"),
  document: songTransferDocumentSchema,
}).strict();

export const songTransferCommitSchema = songTransferPreviewSchema.extend({
  documentHash: z.string().regex(/^[a-f0-9]{64}$/, "Identificador da revisão inválido"),
}).strict();

export type PortableSong = z.infer<typeof portableSongSchema>;
export type SongTransferDocument = z.infer<typeof songTransferDocumentSchema>;
export type SongTransferExportInput = z.infer<typeof songTransferExportSchema>;
export type SongTransferPreviewInput = z.infer<typeof songTransferPreviewSchema>;
export type SongTransferCommitInput = z.infer<typeof songTransferCommitSchema>;
