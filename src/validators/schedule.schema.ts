import { z } from "zod";

export const createScheduleSchema = z.object({
  title: z.string().min(2, "Titulo deve ter ao menos 2 caracteres"),
  date: z.coerce.date(),
  ministryId: z.string().uuid("Ministerio invalido"),
});

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
