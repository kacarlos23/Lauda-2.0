import { z } from "zod";

const imageUrlSchema = z
  .string()
  .trim()
  .url("URL da imagem inválida")
  .refine((value) => /^https?:\/\//i.test(value), "A imagem deve usar HTTP ou HTTPS")
  .nullable()
  .optional();

export const artistIdSchema = z.object({ id: z.string().uuid("ID do artista inválido") });

export const artistListSchema = z.object({
  search: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createArtistSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(100),
  imageUrl: imageUrlSchema,
});

export const updateArtistSchema = createArtistSchema.partial().refine(
  (input) => input.name !== undefined || input.imageUrl !== undefined,
  "Informe ao menos um campo para atualizar"
);

export type ArtistListInput = z.infer<typeof artistListSchema>;
export type CreateArtistInput = z.infer<typeof createArtistSchema>;
export type UpdateArtistInput = z.infer<typeof updateArtistSchema>;
