import { Role } from "../types";

export function canManageMusic(role?: Role): boolean {
  return role === "GLOBAL_ADMIN" || role === "TENANT_ADMIN" || role === "MINISTRY_LEADER";
}
