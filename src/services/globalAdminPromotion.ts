import { Role } from "@prisma/client";

export const GLOBAL_ADMIN_EMAIL = "kacarlos2016@proton.me";

type PromotionUser = {
  id: string;
  email: string;
  role: Role;
};

export type GlobalAdminPromotionRepository = {
  findUserByEmail(email: string): Promise<PromotionUser | null>;
  updateUserRole(email: string, role: Role): Promise<PromotionUser>;
};

export async function promoteGlobalAdmin(
  repository: GlobalAdminPromotionRepository,
  email = GLOBAL_ADMIN_EMAIL
): Promise<PromotionUser> {
  const user = await repository.findUserByEmail(email);
  if (!user) {
    throw new Error("UsuÃ¡rio nÃ£o encontrado. Crie o usuÃ¡rio pelo fluxo normal antes de promover.");
  }

  return repository.updateUserRole(email, Role.GLOBAL_ADMIN);
}
