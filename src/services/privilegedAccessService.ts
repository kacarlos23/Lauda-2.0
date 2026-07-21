import { Role } from "@prisma/client";
import { basePrisma } from "../config/prisma";
import { config } from "../config/unifiedConfig";
import { SupportResourceName, SupportScope } from "../constants/supportAccess";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors/AppError";
import { AdminRepository } from "../repositories/AdminRepository";
import { CreateSupportGrantInput } from "../validators/supportAccess.schema";
import { writeAdminAuditEvent } from "../audit/adminAudit";

type Actor = { id: string; role: Role };

export class PrivilegedAccessService {
  constructor(private readonly repository = new AdminRepository()) {}

  async createSupportGrant(actor: Actor, input: CreateSupportGrantInput) {
    if (actor.role !== Role.GLOBAL_ADMIN) throw new ForbiddenError("Apenas administrador global pode conceder suporte");
    if (input.expiresInMinutes > config.privilegedAccess.supportMaxMinutes) {
      throw new ValidationError(`Acesso de suporte não pode exceder ${config.privilegedAccess.supportMaxMinutes} minutos`);
    }

    const [grantee, tenant] = await Promise.all([
      basePrisma.user.findFirst({
        where: { id: input.granteeId, isActive: true, deletedAt: null },
        select: { id: true, role: true },
      }),
      basePrisma.tenant.findFirst({
        where: { id: input.tenantId, isActive: true, deletedAt: null },
        select: { id: true },
      }),
    ]);
    if (!grantee) throw new NotFoundError("Usuário de suporte não encontrado");
    if (grantee.role === Role.GLOBAL_ADMIN) {
      throw new ValidationError("GLOBAL_ADMIN não pode receber grant de suporte; use uma conta sem poder global");
    }
    if (!tenant) throw new NotFoundError("Igreja não encontrada");
    if (input.resourceId) {
      const resource = await this.repository.getResourceScoped(input.resource, input.resourceId, input.tenantId);
      if (!resource) throw new NotFoundError("Recurso não encontrado");
    }

    const expiresAt = new Date(Date.now() + input.expiresInMinutes * 60_000);
    return basePrisma.$transaction(async (tx) => {
      const grant = await tx.supportAccessGrant.create({
        data: {
          granteeId: input.granteeId,
          grantedById: actor.id,
          tenantId: input.tenantId,
          resource: input.resource,
          resourceId: input.resourceId ?? null,
          scopes: [...new Set(input.scopes)],
          ticketReference: input.ticketReference,
          reason: input.reason,
          expiresAt,
        },
      });
      await writeAdminAuditEvent(tx, {
          actorId: actor.id,
          actorRole: actor.role,
          action: "support_access_granted",
          resource: "support-access-grants",
          resourceId: grant.id,
          tenantId: grant.tenantId,
          payload: {
            granteeId: grant.granteeId,
            resource: grant.resource,
            targetResourceId: grant.resourceId,
            scopes: grant.scopes,
            ticketReference: grant.ticketReference,
            reason: grant.reason,
            expiresAt: grant.expiresAt.toISOString(),
          },
      });
      return grant;
    });
  }

  listSupportGrants() {
    return basePrisma.supportAccessGrant.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        tenant: { select: { id: true, name: true } },
        grantee: { select: { id: true, name: true, email: true, role: true } },
        grantedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async revokeSupportGrant(actor: Actor, grantId: string, reason: string) {
    if (actor.role !== Role.GLOBAL_ADMIN) throw new ForbiddenError("Apenas administrador global pode revogar suporte");
    return basePrisma.$transaction(async (tx) => {
      const current = await tx.supportAccessGrant.findUnique({ where: { id: grantId } });
      if (!current) throw new NotFoundError("Grant de suporte não encontrado");
      const revokedAt = new Date();
      await tx.supportAccessGrant.update({
        where: { id: grantId },
        data: { revokedAt, revokeReason: reason },
      });
      await writeAdminAuditEvent(tx, {
          actorId: actor.id,
          actorRole: actor.role,
          action: "support_access_revoked",
          resource: "support-access-grants",
          resourceId: grantId,
          tenantId: current.tenantId,
          payload: { reason, ticketReference: current.ticketReference },
      });
      return { id: grantId, revokedAt };
    });
  }

  async authorizeSupportAccess(input: {
    grantId: string;
    userId: string;
    userRole: Role;
    sessionId: string;
    scope: SupportScope;
    resource: SupportResourceName;
    resourceId?: string | null;
  }) {
    const now = new Date();
    return basePrisma.$transaction(async (tx) => {
      const grant = await tx.supportAccessGrant.findFirst({
        where: {
          id: input.grantId,
          granteeId: input.userId,
          revokedAt: null,
          expiresAt: { gt: now },
          scopes: { has: input.scope },
          resource: input.resource,
          OR: [{ resourceId: null }, { resourceId: input.resourceId ?? null }],
          grantee: { isActive: true, deletedAt: null },
          tenant: { isActive: true, deletedAt: null },
        },
      });
      if (!grant || (grant.boundSessionId && grant.boundSessionId !== input.sessionId)) {
        throw new ForbiddenError("Acesso de suporte inválido ou expirado");
      }
      const bound = await tx.supportAccessGrant.updateMany({
        where: {
          id: grant.id,
          revokedAt: null,
          expiresAt: { gt: now },
          OR: [{ boundSessionId: null }, { boundSessionId: input.sessionId }],
        },
        data: { boundSessionId: input.sessionId, lastUsedAt: now },
      });
      if (bound.count !== 1) throw new ForbiddenError("Acesso de suporte inválido ou expirado");
      await writeAdminAuditEvent(tx, {
          actorId: input.userId,
          actorRole: input.userRole,
          action: "support_access_used",
          resource: input.resource,
          resourceId: input.resourceId ?? null,
          tenantId: grant.tenantId,
          payload: {
            grantId: grant.id,
            ticketReference: grant.ticketReference,
            scope: input.scope,
            sessionId: input.sessionId,
          },
      });
      return grant;
    });
  }

  listSupportResource(resource: SupportResourceName, tenantId: string, query: { search?: string; page: number; limit: number }) {
    return Promise.all([
      this.repository.listResource(resource, { ...query, tenantId }),
      this.repository.countResource(resource, { search: query.search, tenantId }),
    ]).then(([items, total]) => ({
      items,
      pagination: { ...query, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
    }));
  }

  async getSupportResource(resource: SupportResourceName, id: string, tenantId: string) {
    const item = await this.repository.getResourceScoped(resource, id, tenantId);
    if (!item) throw new NotFoundError("Registro não encontrado");
    return item;
  }
}
