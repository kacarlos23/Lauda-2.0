import { Role } from "../types";

export function isGlobalAdmin(user?: { role?: Role | string } | null): boolean {
  return user?.role === "GLOBAL_ADMIN";
}

export function isTenantAdmin(user?: { role?: Role | string } | null): boolean {
  return user?.role === "TENANT_ADMIN";
}

export function isChurchAdmin(user?: { role?: Role | string } | null): boolean {
  return canManageMembers(user?.role);
}

export function canAccessGlobalAdminArea(role?: Role | string): boolean {
  return role === "GLOBAL_ADMIN";
}

export function canManageChurch(role?: Role | string): boolean {
  return role === "GLOBAL_ADMIN" || role === "TENANT_ADMIN";
}

export function canManageMembers(role?: Role | string): boolean {
  return canManageChurch(role);
}

export function canViewMembers(role?: Role | string): boolean {
  return canManageMembers(role) || role === "MINISTRY_LEADER";
}

export function formatRoleLabel(role?: Role | string): string {
  const labels: Record<string, string> = {
    GLOBAL_ADMIN: "Administrador global",
    TENANT_ADMIN: "Administrador da igreja",
    MINISTRY_LEADER: "Líder de ministério",
    MEMBER: "Membro",
  };
  return labels[role ?? ""] ?? "";
}
