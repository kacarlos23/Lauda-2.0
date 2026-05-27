import { Role } from "@prisma/client";

export type AuthUser = {
  id?: string;
  role?: Role | string;
  tenantId?: string;
};

export function isGlobalAdmin(user?: AuthUser | null): boolean {
  return user?.role === Role.GLOBAL_ADMIN;
}

export function isTenantAdmin(user?: AuthUser | null): boolean {
  return user?.role === Role.TENANT_ADMIN;
}

export function isChurchAdmin(user?: AuthUser | null): boolean {
  return isGlobalAdmin(user) || isTenantAdmin(user);
}

export function isMinistryLeader(user?: AuthUser | null): boolean {
  return user?.role === Role.MINISTRY_LEADER;
}

export function isMember(user?: AuthUser | null): boolean {
  return user?.role === Role.MEMBER;
}

export function canManageTenant(user?: AuthUser | null, tenantId?: string): boolean {
  if (isGlobalAdmin(user)) return true;
  return isTenantAdmin(user) && Boolean(tenantId) && user?.tenantId === tenantId;
}

export function canViewTenantData(user?: AuthUser | null, tenantId?: string): boolean {
  if (isGlobalAdmin(user)) return true;
  return Boolean(tenantId) && user?.tenantId === tenantId;
}
