import { z } from "zod";

export const INSTRUMENT_ICON_KEYS = ["vocalista", "back_vocal", "baixo", "bateria", "flauta", "guitarra", "mesa_som", "multimidia", "piano", "saxofone", "teclado", "violao", "violino", "cajon", "pandeiro", "tamborim", "congas", "acordeon", "trompete", "trombone", "violoncelo", "harpa", "ukulele", "regente", "fone", "outro"] as const;

export const instrumentIdSchema = z.object({
  id: z.string().uuid("ID do instrumento inválido"),
});

export const createInstrumentSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(50, "Nome deve ter no máximo 50 caracteres"),
  iconKey: z.enum(INSTRUMENT_ICON_KEYS).optional().nullable(),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor deve estar no formato #RRGGBB").optional().nullable(),
});

export const updateInstrumentSchema = createInstrumentSchema.partial().refine(
  (input) => input.name !== undefined || input.colorHex !== undefined || input.iconKey !== undefined,
  "Informe ao menos um campo para atualizar"
);

export type CreateInstrumentInput = z.infer<typeof createInstrumentSchema>;
export type UpdateInstrumentInput = z.infer<typeof updateInstrumentSchema>;
