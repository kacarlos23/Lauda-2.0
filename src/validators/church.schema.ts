import { z } from "zod";
import { richTextCommentsSchema } from "./richText.schema";

export const updateChurchSchema = z.object({
  name: z.string().trim().min(1, "Nome da igreja é obrigatório"),
  comments: richTextCommentsSchema,
});

export type UpdateChurchInput = z.infer<typeof updateChurchSchema>;
