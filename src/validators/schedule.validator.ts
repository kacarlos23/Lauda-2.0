import { z } from "zod";

const isoDateTimeMessage = "Data deve estar em formato ISO datetime válido";
const uuidMessage = "Identificador deve ser um UUID válido";

export const UuidParamsSchema = z.object({
  id: z.string().uuid(uuidMessage),
});

export const AssignmentParamsSchema = z.object({
  id: z.string().uuid(uuidMessage),
  assignmentId: z.string().uuid(uuidMessage),
});

export const AssignmentStatusSchema = z.enum(["PENDING", "ACCEPTED", "DECLINED"], {
  error: "Status deve ser PENDING, ACCEPTED ou DECLINED",
});

export const CreateScheduleSchema = z.object({
  title: z
    .string({ error: "Título é obrigatório" })
    .trim()
    .min(3, "Título deve ter entre 3 e 100 caracteres")
    .max(100, "Título deve ter entre 3 e 100 caracteres"),
  date: z
    .string({ error: "Data é obrigatória" })
    .datetime({ message: isoDateTimeMessage })
    .transform((value) => new Date(value)),
  ministryId: z.string({ error: "Ministério é obrigatório" }).uuid("Ministério deve ser um UUID válido"),
});

export const CreateAssignmentSchema = z.object({
  userId: z.string({ error: "Usuário é obrigatório" }).uuid("Usuário deve ser um UUID válido"),
  role: z
    .string({ error: "Função é obrigatória" })
    .trim()
    .min(2, "Função deve ter ao menos 2 caracteres"),
});

export const UpdateAssignmentStatusSchema = z.object({
  status: AssignmentStatusSchema,
});

export type CreateScheduleInput = z.infer<typeof CreateScheduleSchema>;
export type CreateAssignmentInput = z.infer<typeof CreateAssignmentSchema>;
export type UpdateAssignmentStatusInput = z.infer<typeof UpdateAssignmentStatusSchema>;

export const createScheduleSchema = CreateScheduleSchema;
export const createAssignmentSchema = CreateAssignmentSchema;
export const updateAssignmentStatusSchema = UpdateAssignmentStatusSchema;
export const uuidParamsSchema = UuidParamsSchema;
export const assignmentParamsSchema = AssignmentParamsSchema;
