import { Role } from "@prisma/client";
import { PermissionKey, permissionDefinitions, permissionKeys, rolePermissionMap } from "./permissionContract";

export * from "./permissionContract";

export function isPermissionKey(value: string): value is PermissionKey {
  return permissionKeys.includes(value as PermissionKey);
}

export function rolePermissions(role?: Role | string | null): PermissionKey[] {
  if (!role || !(role in rolePermissionMap)) return [];
  return [...rolePermissionMap[role as keyof typeof rolePermissionMap]];
}

export { permissionDefinitions };
