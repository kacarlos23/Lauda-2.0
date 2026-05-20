import { z } from "zod";

export const registerSchema = z.object({
  churchName: z.string().min(2, "Nome da igreja é obrigatório"),
  name: z.string().min(2, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
});

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token é obrigatório"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

export const resetPasswordSchema = z.object({
  email: z.string().email("E-mail inválido"),
  token: z.string().length(6, "PIN deve ter exatamente 6 dígitos"),
  newPassword: z.string().min(6, "A nova senha deve ter no mínimo 6 caracteres"),
});

export const publicMemberRegisterSchema = z.object({
  inviteCode: z.string().min(8, "Código de convite é obrigatório"),
  name: z.string().min(2, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido"),
  phone: z.string().optional(),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type PublicMemberRegisterInput = z.infer<typeof publicMemberRegisterSchema>;
