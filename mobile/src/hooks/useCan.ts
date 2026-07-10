import { PermissionKey } from "../types";
import { useAuthStore } from "../store/authStore";
import { can } from "../utils/permissions";

export function useCan(permission: PermissionKey): boolean {
  const user = useAuthStore((state) => state.user);
  return can(user, permission);
}
