import { z } from "zod";

export const createMemberSchema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
  phone: z.string().optional(),
  role: z
    .enum(["MEMBER", "MINISTRY_LEADER"])
    .default("MEMBER"),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;
