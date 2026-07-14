import { PermissionEffect, Prisma, Role } from "@prisma/client";
import { basePrisma } from "../config/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors/AppError";
import {
  PermissionKey,
  assignablePermissionKeys,
  normalizePermissionKey,
  permissionKeys,
  rolePermissions,
} from "../constants/permissions";

export type PermissionActor = {
  id: string;
  role: Role;
  tenantId?: string | null;
};

export type PermissionUser = {
  id: string;
  role: Role;
  tenantId?: string | null;
  permissions?: string[];
};

export type PermissionOverrideInput = {
  permissionKey: PermissionKey;
  effect: PermissionEffect;
};

export async function explicitPermissionOverrides(userId: string, tenantId?: string | null) {
  if (!tenantId) return [];
  return basePrisma.userPermission.findMany({
    where: { userId, tenantId },
    select: {
      effect: true,
      permission: { select: { key: true, assignable: true } },
    },
  });
}

export async function explicitPermissionKeys(userId: string, tenantId?: string | null): Promise<PermissionKey[]> {
  const overrides = await explicitPermissionOverrides(userId, tenantId);
  return overrides
    .filter((override) => override.effect === PermissionEffect.ALLOW && override.permission.assignable)
    .map((override) => override.permission.key as PermissionKey);
}

export async function effectivePermissionKeys(user: PermissionUser, tenantId?: string | null): Promise<PermissionKey[]> {
  if (user.role === Role.GLOBAL_ADMIN) return [...permissionKeys];

  const effective = new Set(rolePermissions(user.role));
  const overrides = await explicitPermissionOverrides(user.id, tenantId ?? user.tenantId ?? null);
  for (const override of overrides) {
    const key = normalizePermissionKey(override.permission.key);
    if (!key || !override.permission.assignable) continue;
    if (override.effect === PermissionEffect.DENY) effective.delete(key);
    else effective.add(key);
  }
  return permissionKeys.filter((key) => effective.has(key));
}

export async function hasPermission(user: PermissionUser, permissionKey: PermissionKey, tenantId?: string | null): Promise<boolean> {
  if (user.role === Role.GLOBAL_ADMIN) return true;
  if (permissionKey === "permissions:manage") return false;
  if (Array.isArray(user.permissions)) return user.permissions.includes(permissionKey);
  return (await effectivePermissionKeys(user, tenantId)).includes(permissionKey);
}

export async function requireUserPermission(user: PermissionUser, permissionKey: PermissionKey, tenantId?: string | null): Promise<void> {
  if (!await hasPermission(user, permissionKey, tenantId)) {
    throw new ForbiddenError("Usuário sem permissão para esta ação");
  }
}

export class PermissionService {
  async listPermissions() {
    return basePrisma.permission.findMany({
      where: { key: { in: permissionKeys } },
      orderBy: [{ category: "asc" }, { key: "asc" }],
    });
  }

  async listUserPermissions(userId: string) {
    const user = await this.findUser(userId);
    const tenantId = this.resolveTenantId(user);
    const overrides = tenantId ? await basePrisma.userPermission.findMany({
      where: { userId, tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        permission: true,
        tenant: { select: { id: true, name: true } },
        grantedBy: { select: { id: true, name: true, email: true } },
      },
    }) : [];
    const baseline = rolePermissions(user.role);
    const effective = await effectivePermissionKeys(user, tenantId);
    return {
      user,
      baseline,
      overrides,
      effective,
      // Compatibility for clients that only know ALLOW grants.
      grants: overrides.filter((override) => override.effect === PermissionEffect.ALLOW),
    };
  }

  async grantPermission(actor: PermissionActor, input: PermissionOverrideInput & { userId: string }) {
    this.ensureGlobalAdmin(actor);
    const target = await this.ensureEditableTarget(actor, input.userId);
    const permissionKey = this.ensureAssignableKey(input.permissionKey);
    const permission = await this.findPermission(permissionKey);
    const tenantId = this.requireTenantId(target);

    const override = await basePrisma.userPermission.upsert({
      where: { userId_permissionId_tenantId: { userId: target.id, permissionId: permission.id, tenantId } },
      update: { effect: input.effect, grantedById: actor.id },
      create: { userId: target.id, permissionId: permission.id, tenantId, grantedById: actor.id, effect: input.effect },
      include: { permission: true, tenant: { select: { id: true, name: true } } },
    });
    await this.audit(actor, "set_permission_override", target.id, tenantId, { permissionKey, effect: input.effect });
    return override;
  }

  async revokePermission(actor: PermissionActor, input: { userId: string; permissionKey: PermissionKey }) {
    this.ensureGlobalAdmin(actor);
    const target = await this.ensureEditableTarget(actor, input.userId);
    const permissionKey = this.ensureAssignableKey(input.permissionKey);
    const tenantId = this.requireTenantId(target);
    const deleted = await basePrisma.userPermission.deleteMany({
      where: { userId: target.id, tenantId, permission: { key: permissionKey } },
    });
    if (deleted.count === 0) throw new NotFoundError("Override de permissão não encontrado");
    await this.audit(actor, "remove_permission_override", target.id, tenantId, { permissionKey });
    return { removed: deleted.count };
  }

  async setUserPermissions(actor: PermissionActor, input: { userId: string; overrides: PermissionOverrideInput[] }) {
    this.ensureGlobalAdmin(actor);
    const target = await this.ensureEditableTarget(actor, input.userId);
    const tenantId = this.requireTenantId(target);
    const normalized = this.normalizeOverrides(input.overrides);
    const permissions = await basePrisma.permission.findMany({
      where: { key: { in: normalized.map((override) => override.permissionKey) }, assignable: true },
      select: { id: true, key: true },
    });
    if (permissions.length !== normalized.length) throw new ValidationError("Uma ou mais permissões são inválidas ou não delegáveis");

    const before = await basePrisma.userPermission.findMany({
      where: { userId: target.id, tenantId },
      select: { effect: true, permission: { select: { key: true } } },
    });
    const permissionByKey = new Map(permissions.map((permission) => [permission.key, permission.id]));
    await basePrisma.$transaction(async (tx) => {
      await tx.userPermission.deleteMany({ where: { userId: target.id, tenantId } });
      if (normalized.length > 0) {
        await tx.userPermission.createMany({
          data: normalized.map((override) => ({
            userId: target.id,
            permissionId: permissionByKey.get(override.permissionKey)!,
            tenantId,
            grantedById: actor.id,
            effect: override.effect,
          })),
        });
      }
    });
    await this.audit(actor, "set_permission_overrides", target.id, tenantId, {
      before: before.map((item) => ({ permissionKey: item.permission.key, effect: item.effect })),
      after: normalized,
    });
    return this.listUserPermissions(target.id);
  }

  private normalizeOverrides(overrides: PermissionOverrideInput[]): PermissionOverrideInput[] {
    const result = new Map<PermissionKey, PermissionEffect>();
    for (const override of overrides) {
      const permissionKey = this.ensureAssignableKey(override.permissionKey);
      result.set(permissionKey, override.effect);
    }
    return Array.from(result, ([permissionKey, effect]) => ({ permissionKey, effect }));
  }

  private ensureAssignableKey(value: string): PermissionKey {
    const key = normalizePermissionKey(value);
    if (!key || !assignablePermissionKeys.includes(key)) {
      throw new ValidationError("Permissão inválida ou não delegável");
    }
    return key;
  }

  private ensureGlobalAdmin(actor: PermissionActor) {
    if (actor.role !== Role.GLOBAL_ADMIN) throw new ForbiddenError("Apenas administrador global pode gerenciar permissões");
  }

  private async ensureEditableTarget(actor: PermissionActor, userId: string) {
    if (actor.id === userId) throw new ForbiddenError("Administrador global não pode editar as próprias permissões");
    const target = await this.findUser(userId);
    if (target.role === Role.GLOBAL_ADMIN) throw new ForbiddenError("Permissões de administrador global não podem ser personalizadas");
    return target;
  }

  private async findUser(userId: string) {
    const user = await basePrisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, tenantId: true },
    });
    if (!user) throw new NotFoundError("Usuário não encontrado");
    return user;
  }

  private resolveTenantId(user: { role: Role; tenantId: string | null }): string | null {
    if (user.role === Role.GLOBAL_ADMIN) return null;
    if (!user.tenantId) throw new ValidationError("Usuário não-global deve estar vinculado a uma igreja");
    return user.tenantId;
  }

  private requireTenantId(user: { role: Role; tenantId: string | null }): string {
    const tenantId = this.resolveTenantId(user);
    if (!tenantId) throw new ValidationError("Usuário gerenciado deve estar vinculado a uma igreja");
    return tenantId;
  }

  private async findPermission(permissionKey: PermissionKey) {
    const permission = await basePrisma.permission.findFirst({ where: { key: permissionKey, assignable: true } });
    if (!permission) throw new NotFoundError("Permissão não encontrada");
    return permission;
  }

  private async audit(actor: PermissionActor, action: string, resourceId: string, tenantId: string | null, payload: Prisma.InputJsonObject) {
    await basePrisma.adminAuditLog.create({
      data: { actorId: actor.id, actorRole: actor.role, action, resource: "user-permissions", resourceId, tenantId, payload },
    });
  }
}
