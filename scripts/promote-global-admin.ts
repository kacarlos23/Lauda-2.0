import { Role } from "@prisma/client";
import { basePrisma } from "../src/config/prisma";
import { promoteGlobalAdmin } from "../src/services/globalAdminPromotion";
import { writeAdminAuditEvent } from "../src/audit/adminAudit";
import { logger } from "../src/observability/logger";

function argument(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1]?.trim() : "";
  if (!value) throw new Error(`Parâmetro obrigatório ausente: --${name}`);
  return value;
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Promoção por script é bloqueada em produção; use o fluxo administrativo com MFA e step-up.");
  }

  const request = {
    targetEmail: argument("email"),
    actorId: argument("actor-id"),
    reason: argument("reason"),
    ticketReference: argument("ticket"),
    confirmation: argument("confirm"),
  };

  const user = await promoteGlobalAdmin({
    findUserByEmail: (email) => basePrisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, tenantId: true },
    }),
    promoteWithAudit: (input) => basePrisma.$transaction(async (tx) => {
      const actor = await tx.user.findUnique({ where: { id: input.actorId }, select: { id: true } });
      if (!actor) throw new Error("Ator de bootstrap não encontrado.");
      const updated = await tx.user.update({
        where: { id: input.targetUserId },
        data: { role: Role.GLOBAL_ADMIN, tenantId: null },
        select: { id: true, email: true, role: true, tenantId: true },
      });
      await tx.userPermission.deleteMany({ where: { userId: input.targetUserId } });
      await writeAdminAuditEvent(tx, {
          actorId: input.actorId,
          actorRole: Role.GLOBAL_ADMIN,
          action: "global_admin_promoted_bootstrap",
          resource: "users",
          resourceId: input.targetUserId,
          payload: {
            reason: input.reason,
            ticketReference: input.ticketReference,
          },
      });
      return updated;
    }),
  }, request);

  logger.info("global_admin_promoted_bootstrap", {
    category: "audit",
    actorId: request.actorId,
    resource: "users",
    resourceId: user.id,
    outcome: "success",
  });
}

main()
  .catch((error) => {
    logger.error("global_admin_promotion_failed", {
      category: "security",
      errorName: error instanceof Error ? error.name : "UnknownError",
      outcome: "error",
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await basePrisma.$disconnect();
  });
