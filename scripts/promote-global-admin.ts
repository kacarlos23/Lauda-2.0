import { Role } from "@prisma/client";
import { basePrisma } from "../src/config/prisma";
import { GLOBAL_ADMIN_EMAIL, promoteGlobalAdmin } from "../src/services/globalAdminPromotion";

async function main() {
  console.log(`E-mail alvo: ${GLOBAL_ADMIN_EMAIL}`);

  const user = await promoteGlobalAdmin({
    findUserByEmail: (email) =>
      basePrisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, role: true },
      }),
    updateUserRole: (email, role: Role) =>
      basePrisma.user.update({
        where: { email },
        data: { role },
        select: { id: true, email: true, role: true },
      }),
  });

  console.log(`Usuário ${user.email} promovido para ${user.role}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Falha ao promover administrador global.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await basePrisma.$disconnect();
  });
