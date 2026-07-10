import { PermissionKey, Role, User } from "../types";
import { can } from "./permissions";

export function canManageMusic(subject?: Pick<User, "role" | "permissions"> | Role | null, permission: PermissionKey = "song:create"): boolean {
  return can(subject, permission);
}
