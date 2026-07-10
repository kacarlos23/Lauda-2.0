import { Prisma, Role } from "@prisma/client";
import { basePrisma } from "../config/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../errors/AppError";
import { PermissionKey, permissionDefinitions, rolePermissions } from "../constants/permissions";

export type PermissionActor = {
  id: string;
  role: Role;
  tenantId?: string | null;
};

export type PermissionUser = {
  id: string;
  role: Role;
  tenantId?: string | null;
};

export async function explicitPermissionKeys(userId: string, tenantId?: string | null): Promise<PermissionKey[]> {
  const grants = await basePrisma.userPermission.findMany({
    where: {
      userId,
      OR: [
        { tenantId: tenantId ?? null },
        { tenantId: null },
      ],
    },
    select: { permission: { select: { key: true } } },
  });
  return grants.map((grant) => grant.permission.key as PermissionKey);
}

export async function effectivePermissionKeys(user: PermissionUser, tenantId?: string | null): Promise<PermissionKey[]> {
  const roleKeys = rolePermissions(user.role);
  const explicitKeys = await explicitPermissionKeys(user.id, tenantId ?? user.tenantId ?? null);
  return Array.from(new Set([...roleKeys, ...explicitKeys]));
}

export async function hasPermission(user: PermissionUser, permissionKey: PermissionKey, tenantId?: string | null): Promise<boolean> {
  if (user.role === Role.GLOBAL_ADMIN) return true;
  if (rolePermissions(user.role).includes(permissionKey)) return true;

  const resolvedTenantId = tenantId ?? user.tenantId ?? null;
  const grant = await basePrisma.userPermission.findFirst({
    where: {
      userId: user.id,
      permission: { key: permissionKey },
      OR: [
        { tenantId: resolvedTenantId },
        { tenantId: null },
      ],
    },
    select: { id: true },
  });

  return Boolean(grant);
}

export async function requireUserPermission(user: PermissionUser, permissionKey: PermissionKey, tenantId?: string | null): Promise<void> {
  if (!await hasPermission(user, permissionKey, tenantId)) {
    throw new ForbiddenError("Usuário sem permissão para esta ação");
  }
}

export class PermissionService {
  async listPermissions() {
    await this.ensureCatalog();
    return basePrisma.permission.findMany({ orderBy: [{ category: "asc" }, { key: "asc" }] });
  }

  async listUserPermissions(userId: string, tenantId?: string) {
    const user = await this.findUser(userId);
    const grants = await basePrisma.userPermission.findMany({
      where: {
        userId,
        ...(tenantId ? { tenantId } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        permission: true,
        tenant: { select: { id: true, name: true } },
        grantedBy: { select: { id: true, name: true, email: true } },
      },
    });
    const effective = await effectivePermissionKeys(user, tenantId ?? user.tenantId);
    return { user, grants, effective };
  }

  async grantPermission(actor: PermissionActor, input: { userId: string; permissionKey: PermissionKey; tenantId?: string | null }) {
    this.ensureGlobalAdmin(actor);
    if (actor.id === input.userId) {
      throw new ForbiddenError("Usuário não pode conceder permissões a si mesmo");
    }
    await this.ensureCatalog();
    const [target, permission] = await Promise.all([
      this.findUser(input.userId),
      basePrisma.permission.findUnique({ where: { key: input.permissionKey } }),
    ]);
    if (!permission) throw new NotFoundError("Permissão não encontrada");
    const tenantId = await this.resolveTenantId(target, input.tenantId);

    try {
      const grant = await basePrisma.userPermission.create({
        data: {
          userId: target.id,
          permissionId: permission.id,
          tenantId,
          grantedById: actor.id,
        },
        include: { permission: true, tenant: { select: { id: true, name: true } } },
      });
      await this.audit(actor, "grant_permission", target.id, tenantId, { permissionKey: input.permissionKey });
      return grant;
    } catch (error: any) {
      if (error?.code === "P2002") throw new ConflictError("Usuário já possui esta permissão");
      throw error;
    }
  }

  async revokePermission(actor: PermissionActor, input: { userId: string; permissionKey: PermissionKey; tenantId?: string | null }) {
    this.ensureGlobalAdmin(actor);
    if (actor.id === input.userId) {
      throw new ForbiddenError("Usuário não pode remover permissões de si mesmo");
    }
    const target = await this.findUser(input.userId);
    const tenantId = await this.resolveTenantId(target, input.tenantId);
    const deleted = await basePrisma.userPermission.deleteMany({
      where: {
        userId: target.id,
        tenantId,
        permission: { key: input.permissionKey },
      },
    });
    if (deleted.count === 0) throw new NotFoundError("Permissão atribuída não encontrada");
    await this.audit(actor, "revoke_permission", target.id, tenantId, { permissionKey: input.permissionKey });
    return { removed: deleted.count };
  }

  async setUserPermissions(actor: PermissionActor, input: { userId: string; permissionKeys: PermissionKey[]; tenantId?: string | null }) {
    this.ensureGlobalAdmin(actor);
    if (actor.id === input.userId) {
      throw new ForbiddenError("Usuário não pode editar as próprias permissões");
    }
    await this.ensureCatalog();
    const target = await this.findUser(input.userId);
    const tenantId = await this.resolveTenantId(target, input.tenantId);
    const uniqueKeys = Array.from(new Set(input.permissionKeys));
    const permissions = await basePrisma.permission.findMany({ where: { key: { in: uniqueKeys } } });
    if (permissions.length !== uniqueKeys.length) throw new ValidationError("Uma ou mais permissões são inválidas");

    await basePrisma.$transaction(async (tx) => {
      await tx.userPermission.deleteMany({ where: { userId: target.id, tenantId } });
      if (permissions.length > 0) {
        await tx.userPermission.createMany({
          data: permissions.map((permission) => ({
            userId: target.id,
            permissionId: permission.id,
            tenantId,
            grantedById: actor.id,
          })),
        });
      }
    });
    await this.audit(actor, "set_permissions", target.id, tenantId, { permissionKeys: uniqueKeys });
    return this.listUserPermissions(target.id, tenantId ?? undefined);
  }

  private ensureGlobalAdmin(actor: PermissionActor) {
    if (actor.role !== Role.GLOBAL_ADMIN) {
      throw new ForbiddenError("Apenas administrador global pode gerenciar permissões");
    }
  }

  private async findUser(userId: string) {
    const user = await basePrisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, tenantId: true },
    });
    if (!user) throw new NotFoundError("Usuário não encontrado");
    return user;
  }

  private async resolveTenantId(user: { role: Role; tenantId: string | null }, inputTenantId?: string | null) {
    if (user.role === Role.GLOBAL_ADMIN) return inputTenantId ?? null;
    const tenantId = inputTenantId ?? user.tenantId;
    if (!tenantId) throw new ValidationError("Permissão de usuário não-global deve estar vinculada a uma igreja");
    if (user.tenantId && tenantId !== user.tenantId) throw new ForbiddenError("Permissão deve pertencer ao tenant do usuário");
    const tenant = await basePrisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) throw new NotFoundError("Igreja não encontrada");
    return tenantId;
  }

  private async ensureCatalog() {
    for (const definition of permissionDefinitions) {
      await basePrisma.permission.upsert({
        where: { key: definition.key },
        update: { description: definition.description, category: definition.category },
        create: definition,
      });
    }
  }

  private async audit(actor: PermissionActor, action: string, resourceId: string, tenantId: string | null, payload: Prisma.InputJsonObject) {
    await basePrisma.adminAuditLog.create({
      data: {
        actorId: actor.id,
        actorRole: actor.role,
        action,
        resource: "user-permissions",
        resourceId,
        tenantId,
        payload,
      },
    });
  }
}
