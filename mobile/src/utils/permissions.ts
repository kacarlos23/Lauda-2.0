import { User } from "../types";

export function isChurchAdmin(user?: Pick<User, "role"> | null): boolean {
  return user?.role === "TENANT_ADMIN" || user?.role === "GLOBAL_ADMIN";
}
