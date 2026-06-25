import { z } from "zod";

export const createMemberSchema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
  phone: z.string().optional(),
  role: z.enum(["MEMBER", "MINISTRY_LEADER"]).default("MEMBER"),
});

export const addMemberMinistrySchema = z.object({
  ministryId: z.string().uuid("ID do ministério inválido"),
  isLeader: z.boolean().optional().default(false),
});

export const updateMemberInstrumentsSchema = z.object({
  instrumentIds: z.array(z.string().uuid("ID do instrumento inválido")),
});

const avatarUrlSchema = z.string().max(3_000_000, "A imagem deve ter no máximo 2 MB").refine(
  (value) => /^https?:\/\//i.test(value) || /^data:image\/(?:jpeg|png|webp);base64,/i.test(value),
  "Imagem de perfil inválida"
);

export const updateMyProfileSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(100).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  avatarUrl: avatarUrlSchema.nullable().optional(),
}).refine((input) => Object.keys(input).length > 0, "Informe ao menos um dado para atualizar");

export const toggleMinistryMemberSchema = z.object({
  member_id: z.string().uuid("ID do membro inválido").optional(),
  memberId: z.string().uuid("ID do membro inválido").optional(),
}).transform((input, ctx) => {
  const memberId = input.member_id ?? input.memberId;
  if (!memberId) {
    ctx.addIssue({
      code: "custom",
      path: ["member_id"],
      message: "ID do membro é obrigatório",
    });
    return z.NEVER;
  }

    return { member_id: memberId };
  });

export const memberStatusSchema = z.enum(["PENDING", "ACTIVE", "INACTIVE"]);

const assignmentFieldsSchema = z.object({
  userId: z.string().uuid("ID do usuário inválido"),
  ministryId: z.string().uuid("ID do ministério inválido"),
  roleId: z.string().uuid("ID do cargo inválido").optional().nullable(),
  role: z.string().trim().min(2, "Cargo deve ter ao menos 2 caracteres").max(80).optional().nullable(),
  skills: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
  status: memberStatusSchema.optional().default("ACTIVE"),
  notes: z.string().trim().max(500).optional().nullable(),
  isLeader: z.boolean().optional().default(false),
});

export const assignMemberToMinistrySchema = assignmentFieldsSchema;

export const updateMemberAssignmentSchema = assignmentFieldsSchema
  .omit({ userId: true, ministryId: true })
  .partial()
  .extend({
    assignmentId: z.string().uuid("ID da atribuição inválido"),
  });

export const listMinistryMembersSchema = z.object({
  status: memberStatusSchema.optional(),
  search: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type AddMemberMinistryInput = z.infer<typeof addMemberMinistrySchema>;
export type UpdateMemberInstrumentsInput = z.infer<typeof updateMemberInstrumentsSchema>;
export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;
export type ToggleMinistryMemberInput = z.infer<typeof toggleMinistryMemberSchema>;
export type AssignMemberToMinistryInput = z.infer<typeof assignMemberToMinistrySchema>;
export type UpdateMemberAssignmentInput = z.infer<typeof updateMemberAssignmentSchema>;
export type ListMinistryMembersInput = z.infer<typeof listMinistryMembersSchema>;
