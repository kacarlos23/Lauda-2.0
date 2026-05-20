import { z } from "zod";

export const registerSchema = z.object({
  churchName: z.string().min(2, "Nome da igreja e obrigatorio"),
  name: z.string().min(2, "Nome e obrigatorio"),
  email: z.string().email("E-mail invalido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
});

export const loginSchema = z.object({
  email: z.string().email("E-mail invalido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token e obrigatorio"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("E-mail invalido"),
});

export const resetPasswordSchema = z.object({
  email: z.string().email("E-mail invalido"),
  token: z.string().length(6, "PIN deve ter exatamente 6 digitos"),
  newPassword: z.string().min(6, "A nova senha deve ter no minimo 6 caracteres"),
});

export const publicMemberRegisterSchema = z.object({
  inviteCode: z.string().trim().min(16, "Codigo de convite e obrigatorio"),
  name: z.string().trim().min(2, "Nome e obrigatorio"),
  email: z.string().trim().toLowerCase().email("E-mail invalido"),
  phone: z.string().trim().optional(),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type PublicMemberRegisterInput = z.infer<typeof publicMemberRegisterSchema>;
