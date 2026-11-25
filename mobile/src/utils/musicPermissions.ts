import { PermissionKey, Role, User } from "../types";
import { can } from "./permissions";

export function canManageMusic(subject?: Pick<User, "role" | "permissions"> | Role | null, permission: PermissionKey = "song:create"): boolean {
  return can(subject, permission);
}

export function canViewArtists(subject?: Pick<User, "role" | "permissions"> | Role | null): boolean {
  return can(subject, "song:view") || can(subject, "song:create") || can(subject, "song:edit");
}
