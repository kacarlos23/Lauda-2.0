import { z } from "zod";

import { richTextCommentsSchema } from "./richText.schema";

const isoDateTimeMessage = "Data deve estar em formato ISO datetime válido";

export const uuidParamSchema = z.object({
  id: z.string().uuid("ID deve ser um UUID válido"),
});

export const assignmentParamsSchema = z.object({
  id: z.string().uuid("ID da escala deve ser um UUID válido"),
  assignmentId: z.string().uuid("ID da atribuição deve ser um UUID válido"),
});

export const AssignmentStatusSchema = z.enum(["PENDING", "ACCEPTED", "DECLINED"], {
  error: "Status deve ser PENDING, ACCEPTED ou DECLINED",
});

const ScheduleAssignmentInputSchema = z.object({
  userId: z.string({ error: "Usuário é obrigatório" }).uuid("Usuário deve ser um UUID válido"),
  role: z
    .string({ error: "Função é obrigatória" })
    .trim()
    .min(2, "Função deve ter ao menos 2 caracteres")
    .max(100, "Função deve ter no máximo 100 caracteres"),
});

const ScheduleWriteSchema = z.object({
  title: z
    .string({ error: "Título é obrigatório" })
    .trim()
    .min(3, "Título deve ter entre 3 e 100 caracteres")
    .max(100, "Título deve ter entre 3 e 100 caracteres"),
  date: z
    .string({ error: "Data é obrigatÃ³ria" })
    .datetime({ message: isoDateTimeMessage })
    .transform((value) => new Date(value)),
  ministryId: z.string({ error: "Ministério é obrigatório" }).uuid("Ministério deve ser um UUID válido"),
  comments: richTextCommentsSchema,
  assignments: z.array(ScheduleAssignmentInputSchema).default([]),
  songIds: z.array(z.string().uuid("Música deve ser um UUID válido")).default([]),
});

export const CreateScheduleSchema = ScheduleWriteSchema;
export const UpdateScheduleSchema = ScheduleWriteSchema;

export const ListSchedulesSchema = z.object({
  from: z.string().datetime({ message: isoDateTimeMessage }).optional().transform((value) => value ? new Date(value) : undefined),
  to: z.string().datetime({ message: isoDateTimeMessage }).optional().transform((value) => value ? new Date(value) : undefined),
  ministryId: z.string().uuid("Ministério deve ser um UUID válido").optional(),
});

export const CreateAssignmentSchema = ScheduleAssignmentInputSchema;

export const UpdateAssignmentStatusSchema = z.object({
  status: AssignmentStatusSchema,
  declineReason: z.string().trim().max(500, "Motivo deve ter no máximo 500 caracteres").optional(),
  requestSubstitute: z.boolean().optional(),
});

export const ResolveSubstitutionSchema = z.object({
  note: z.string().trim().max(500, "Observação deve ter no máximo 500 caracteres").optional(),
});

export type CreateScheduleInput = z.infer<typeof CreateScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof UpdateScheduleSchema>;
export type ListSchedulesInput = z.infer<typeof ListSchedulesSchema>;
export type CreateAssignmentInput = z.infer<typeof CreateAssignmentSchema>;
export type UpdateAssignmentStatusInput = z.infer<typeof UpdateAssignmentStatusSchema>;
export type ResolveSubstitutionInput = z.infer<typeof ResolveSubstitutionSchema>;

export const createScheduleSchema = CreateScheduleSchema;
export const updateScheduleSchema = UpdateScheduleSchema;
export const listSchedulesSchema = ListSchedulesSchema;
export const createAssignmentSchema = CreateAssignmentSchema;
export const updateAssignmentStatusSchema = UpdateAssignmentStatusSchema;
export const resolveSubstitutionSchema = ResolveSubstitutionSchema;

