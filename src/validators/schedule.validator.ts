import { z } from "zod";

const isoDateTimeMessage = "Data deve estar em formato ISO datetime valido";

export const AssignmentStatusSchema = z.enum(["PENDING", "ACCEPTED", "DECLINED"], {
  error: "Status deve ser PENDING, ACCEPTED ou DECLINED",
});

export const CreateScheduleSchema = z.object({
  title: z
    .string({ error: "Titulo e obrigatorio" })
    .trim()
    .min(3, "Titulo deve ter entre 3 e 100 caracteres")
    .max(100, "Titulo deve ter entre 3 e 100 caracteres"),
  date: z
    .string({ error: "Data e obrigatoria" })
    .datetime({ message: isoDateTimeMessage })
    .transform((value) => new Date(value)),
  ministryId: z.string({ error: "Ministerio e obrigatorio" }).uuid("Ministerio deve ser um UUID valido"),
});

export const CreateAssignmentSchema = z.object({
  scheduleId: z.string({ error: "Escala e obrigatoria" }).uuid("Escala deve ser um UUID valido"),
  userId: z.string({ error: "Usuario e obrigatorio" }).uuid("Usuario deve ser um UUID valido"),
  role: z
    .string({ error: "Funcao e obrigatoria" })
    .trim()
    .min(2, "Funcao deve ter ao menos 2 caracteres"),
  status: AssignmentStatusSchema.default("PENDING"),
});

export type CreateScheduleInput = z.infer<typeof CreateScheduleSchema>;
export type CreateAssignmentInput = z.infer<typeof CreateAssignmentSchema>;

export const createScheduleSchema = CreateScheduleSchema;
export const createAssignmentSchema = CreateAssignmentSchema;
