import { z } from "zod";

export const createMemberSchema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  email: z.string().email("E-mail invalido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
  phone: z.string().optional(),
  role: z.enum(["MEMBER", "MINISTRY_LEADER"]).default("MEMBER"),
});

export const addMemberMinistrySchema = z.object({
  ministryId: z.string().uuid("ID do ministerio invalido"),
  isLeader: z.boolean().optional().default(false),
});

export const memberStatusSchema = z.enum(["PENDING", "ACTIVE", "INACTIVE"]);

const assignmentFieldsSchema = z.object({
  userId: z.string().uuid("ID do usuario invalido"),
  ministryId: z.string().uuid("ID do ministerio invalido"),
  roleId: z.string().uuid("ID do cargo invalido").optional().nullable(),
  role: z.string().trim().min(2, "Cargo deve ter ao menos 2 caracteres").max(80).optional().nullable(),
  skills: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
  status: memberStatusSchema.optional().default("PENDING"),
  notes: z.string().trim().max(500).optional().nullable(),
  isLeader: z.boolean().optional().default(false),
});

export const assignMemberToMinistrySchema = assignmentFieldsSchema;

export const updateMemberAssignmentSchema = assignmentFieldsSchema
  .omit({ userId: true, ministryId: true })
  .partial()
  .extend({
    assignmentId: z.string().uuid("ID da atribuicao invalido"),
  });

export const listMinistryMembersSchema = z.object({
  status: memberStatusSchema.optional(),
  search: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type AddMemberMinistryInput = z.infer<typeof addMemberMinistrySchema>;
export type AssignMemberToMinistryInput = z.infer<typeof assignMemberToMinistrySchema>;
export type UpdateMemberAssignmentInput = z.infer<typeof updateMemberAssignmentSchema>;
export type ListMinistryMembersInput = z.infer<typeof listMinistryMembersSchema>;
