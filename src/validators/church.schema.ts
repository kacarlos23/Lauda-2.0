import { z } from "zod";

export const updateChurchSchema = z.object({
  name: z.string().trim().min(1, "Nome da igreja é obrigatório"),
});

export type UpdateChurchInput = z.infer<typeof updateChurchSchema>;
