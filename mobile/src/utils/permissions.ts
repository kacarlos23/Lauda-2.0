import {
  permissionDefinitions as sharedPermissionDefinitions,
  rolePermissionMap as sharedRolePermissionMap,
} from "../../../src/constants/permissionContract";
import { Permission, PermissionKey, Role, User } from "../types";

export const permissionDefinitions: Permission[] = sharedPermissionDefinitions.map((permission) => ({
  ...permission,
  id: permission.key,
}));

export const rolePermissionMap: Record<Role, PermissionKey[]> = sharedRolePermissionMap;

type PermissionSubject = Pick<User, "role" | "permissions"> | Role | string | null | undefined;

function subjectRole(subject?: PermissionSubject): Role | string | undefined {
  return typeof subject === "string" ? subject : subject?.role;
}

export function can(subject: PermissionSubject, permission: PermissionKey): boolean {
  const role = subjectRole(subject);
  if (role === "GLOBAL_ADMIN") return true;

  // Authenticated users receive the effective set from the backend. An empty
  // array is authoritative and can represent DENY overrides over role defaults.
  if (typeof subject === "object" && Array.isArray(subject?.permissions)) {
    return subject.permissions.includes(permission);
  }

  // Compatibility for isolated callers that only have a role, using the same
  // shared baseline as the backend rather than a mobile-specific fallback.
  if (!role || !(role in rolePermissionMap)) return false;
  return rolePermissionMap[role as Role].includes(permission);
}

export function isGlobalAdmin(user?: { role?: Role | string } | null): boolean {
  return user?.role === "GLOBAL_ADMIN";
}

export function isTenantAdmin(user?: { role?: Role | string } | null): boolean {
  return user?.role === "TENANT_ADMIN";
}

export function isChurchAdmin(user?: PermissionSubject): boolean {
  return canManageMembers(user);
}

export function canAccessGlobalAdminArea(subject?: PermissionSubject): boolean {
  return subjectRole(subject) === "GLOBAL_ADMIN";
}

export function canAccessChurchAdmin(subject?: PermissionSubject): boolean {
  return can(subject, "tenant:manage");
}

export function canManageChurch(subject?: PermissionSubject): boolean {
  return can(subject, "tenant:manage");
}

export function canManageMembers(subject?: PermissionSubject): boolean {
  return can(subject, "member:create") || can(subject, "member:invite") || can(subject, "member:assign_ministry");
}

export function canViewMembers(subject?: PermissionSubject): boolean {
  return can(subject, "member:view");
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
