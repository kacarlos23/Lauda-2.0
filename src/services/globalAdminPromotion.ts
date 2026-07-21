import { Role } from "@prisma/client";

type PromotionUser = {
  id: string;
  email: string;
  role: Role;
  tenantId?: string | null;
};

export type GlobalAdminPromotionRequest = {
  targetEmail: string;
  actorId: string;
  reason: string;
  ticketReference: string;
  confirmation: string;
};

export type GlobalAdminPromotionRepository = {
  findUserByEmail(email: string): Promise<PromotionUser | null>;
  promoteWithAudit(input: GlobalAdminPromotionRequest & { targetUserId: string }): Promise<PromotionUser>;
};

export async function promoteGlobalAdmin(
  repository: GlobalAdminPromotionRepository,
  request: GlobalAdminPromotionRequest,
): Promise<PromotionUser> {
  const targetEmail = request.targetEmail.trim().toLowerCase();
  if (!targetEmail || !request.actorId.trim()) throw new Error("Alvo e ator explícitos são obrigatórios.");
  if (request.reason.trim().length < 10) throw new Error("Informe um motivo com ao menos 10 caracteres.");
  if (request.ticketReference.trim().length < 3) throw new Error("Informe um ticket ou referência válido.");
  if (request.confirmation !== `PROMOTE ${targetEmail}`) {
    throw new Error(`Confirmação inválida. Use exatamente: PROMOTE ${targetEmail}`);
  }

  const user = await repository.findUserByEmail(targetEmail);
  if (!user) throw new Error("Usuário não encontrado. Crie o usuário pelo fluxo normal antes de promover.");
  if (user.role === Role.GLOBAL_ADMIN) throw new Error("Usuário já é administrador global.");

  return repository.promoteWithAudit({ ...request, targetEmail, targetUserId: user.id });
}
