import { z } from "zod";

const inviteCodeSchema = z
  .string()
  .trim()
  .refine(
    (value) => /^[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(value) || value.length >= 16,
    "Código de convite é obrigatório"
  );

export const registerSchema = z.object({
  churchName: z.string().min(2, "Nome da igreja é obrigatório"),
  name: z.string().min(2, "Nome é obrigatório"),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
  inviteCode: inviteCodeSchema.optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token é obrigatório"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  token: z.string().regex(/^\d{6}$/, "PIN deve ter exatamente 6 dígitos"),
  newPassword: z.string().min(6, "A nova senha deve ter no mínimo 6 caracteres"),
});

export const publicMemberRegisterSchema = z.object({
  inviteCode: inviteCodeSchema,
  name: z.string().trim().min(2, "Nome é obrigatório"),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  phone: z.string().trim().optional(),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
});

export const memberInviteQuerySchema = z.object({
  ministryId: z.string().uuid("ID do ministério inválido").optional(),
});

export const memberInviteBodySchema = z.object({
  ministryId: z.string().uuid("ID do ministério inválido").optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type PublicMemberRegisterInput = z.infer<typeof publicMemberRegisterSchema>;
export type MemberInviteQueryInput = z.infer<typeof memberInviteQuerySchema>;
export type MemberInviteBodyInput = z.infer<typeof memberInviteBodySchema>;
