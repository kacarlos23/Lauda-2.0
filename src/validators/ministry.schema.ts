import { z } from "zod";

export const createMinistrySchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  description: z.string().optional(),
});

export const updateMinistrySchema = createMinistrySchema.partial();

export type CreateMinistryInput = z.infer<typeof createMinistrySchema>;
export type UpdateMinistryInput = z.infer<typeof updateMinistrySchema>;
