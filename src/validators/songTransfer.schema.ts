import { z } from "zod";
import { LEGACY_SONG_TRANSFER_FIELDS, SONG_TRANSFER_EXISTING_MODES, SONG_TRANSFER_FIELDS } from "../constants/songTransferFields";
import { richTextCommentsSchema } from "./richText.schema";
import { chordContentSchema, MUSICAL_KEYS, songTagsSchema } from "./song.schema";

const optionalHttpUrl = z.preprocess(
  (value) => typeof value === "string" ? value.trim() || null : value,
  z.string()
    .url("Link inválido")
    .refine((value) => value.startsWith("http://") || value.startsWith("https://"), "O link deve começar com http:// ou https://")
    .nullable()
    .optional(),
);

export const portableSongSchema = z.object({
  title: z.string().trim().min(1, "O nome da música é obrigatório").max(200),
  artist: z.string().trim().min(1, "O artista é obrigatório").max(200),
  originalKey: z.enum(MUSICAL_KEYS, "Tom inválido").optional(),
  content: chordContentSchema.optional(),
  bpm: z.number().int().min(30, "O BPM mínimo é 30").max(300, "O BPM máximo é 300").nullable().optional(),
  cifraUrl: optionalHttpUrl,
  letraUrl: optionalHttpUrl,
  audioUrl: optionalHttpUrl,
  videoUrl: optionalHttpUrl,
  comments: richTextCommentsSchema,
  tags: songTagsSchema.optional(),
}).strict();

export const songTransferFieldsSchema = z.array(z.enum(SONG_TRANSFER_FIELDS))
  .min(1, "Selecione ao menos um campo")
  .max(SONG_TRANSFER_FIELDS.length)
  .refine((fields) => new Set(fields).size === fields.length, "A seleção não pode repetir campos");

export const songTransferExistingSchema = z.enum(SONG_TRANSFER_EXISTING_MODES);

const transferOptions = {
  fields: songTransferFieldsSchema.optional(),
  existing: songTransferExistingSchema.optional(),
};

export const legacySongTransferFields = LEGACY_SONG_TRANSFER_FIELDS;

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
  fields: songTransferFieldsSchema.optional(),
}).strict();

export const songTransferPreviewSchema = z.object({
  ministryId: z.string().uuid("ID do ministério inválido"),
  document: songTransferDocumentSchema,
  ...transferOptions,
}).strict();

export const songTransferCommitSchema = songTransferPreviewSchema.extend({
  documentHash: z.string().regex(/^[a-f0-9]{64}$/, "Identificador da revisão inválido"),
}).strict();

export type PortableSong = z.infer<typeof portableSongSchema>;
export type SongTransferDocument = z.infer<typeof songTransferDocumentSchema>;
export type SongTransferExportInput = z.infer<typeof songTransferExportSchema>;
export type SongTransferPreviewInput = z.infer<typeof songTransferPreviewSchema>;
export type SongTransferCommitInput = z.infer<typeof songTransferCommitSchema>;

