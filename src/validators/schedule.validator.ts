import { z } from "zod";

import { richTextCommentsSchema } from "./richText.schema";
import { participationSchema } from "./worshipOrder.schema";

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
    .string({ error: "Data é obrigatória" })
    .datetime({ message: isoDateTimeMessage })
    .transform((value) => new Date(value)),
  ministryId: z.string({ error: "Ministério é obrigatório" }).uuid("Ministério deve ser um UUID válido"),
  comments: richTextCommentsSchema,
  assignments: z.array(ScheduleAssignmentInputSchema).default([]),
  songIds: z.array(z.string().uuid("Música deve ser um UUID válido")).default([]),
  songDetails: z.array(participationSchema).optional(),
  worshipPeriod: z.enum(["MORNING", "EVENING"]).nullable().optional(),
}).superRefine((input, context) => {
  if (!input.songDetails) return;
  const ids = new Set(input.songIds);
  const details = new Set(input.songDetails.map((entry) => entry.songId));
  if (details.size !== input.songDetails.length || details.size !== ids.size || [...details].some((id) => !ids.has(id))) {
    context.addIssue({ code: "custom", path: ["songDetails"], message: "Informe os momentos somente das músicas selecionadas, sem duplicatas" });
  }
});

export const CreateScheduleSchema = ScheduleWriteSchema;
export const UpdateScheduleSchema = ScheduleWriteSchema;

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
const scheduleQueryDateSchema = (boundary: "start" | "end") =>
  z
    .union([
      z.string().datetime({ message: isoDateTimeMessage }),
      z.string().regex(dateOnlyRegex, isoDateTimeMessage),
    ])
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      if (!dateOnlyRegex.test(value)) return new Date(value);
      return new Date(`${value}${boundary === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z"}`);
    });

const optionalPositiveInt = (max: number) =>
  z.preprocess(
    (value) => (value === undefined || value === null || value === "" ? undefined : value),
    z
      .union([
        z.number().int().min(1).max(max),
        z
          .string()
          .regex(/^\d+$/, "Limite deve ser um número inteiro positivo")
          .transform((value) => Number(value))
          .refine((value) => value >= 1 && value <= max, `Limite deve estar entre 1 e ${max}`),
      ])
      .optional(),
  );

const optionalBooleanQuery = z.preprocess(
  (value) => (value === undefined || value === null || value === "" ? undefined : value),
  z
    .union([
      z.boolean(),
      z.enum(["true", "false"]).transform((value) => value === "true"),
    ])
    .optional(),
);

export const ListSchedulesSchema = z.object({
  from: scheduleQueryDateSchema("start"),
  to: scheduleQueryDateSchema("end"),
  dateFrom: scheduleQueryDateSchema("start"),
  dateTo: scheduleQueryDateSchema("end"),
  ministryId: z.string().uuid("Ministério deve ser um UUID válido").optional(),
  limit: optionalPositiveInt(200),
  summary: optionalBooleanQuery,
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

