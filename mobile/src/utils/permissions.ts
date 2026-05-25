import { Role } from "../types";

export function isChurchAdmin(user?: { role?: Role | string } | null): boolean {
  return canManageMembers(user?.role);
}

export function canManageMembers(role?: Role | string): boolean {
  return role === "GLOBAL_ADMIN" || role === "TENANT_ADMIN";
}

export function canViewMembers(role?: Role | string): boolean {
  return canManageMembers(role) || role === "MINISTRY_LEADER";
}
