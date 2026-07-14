import { PermissionEffect, PermissionKey } from "../types";

export type PermissionOverrideMap = Partial<Record<PermissionKey, PermissionEffect>>;

export function nextPermissionEffect(effect?: PermissionEffect): PermissionEffect | undefined {
  if (effect === undefined) return "ALLOW";
  if (effect === "ALLOW") return "DENY";
  return undefined;
}

export function effectivePermissionsFromOverrides(
  baseline: PermissionKey[],
  overrides: PermissionOverrideMap
): PermissionKey[] {
  const effective = new Set(baseline);
  for (const [permissionKey, effect] of Object.entries(overrides)) {
    if (effect === "DENY") effective.delete(permissionKey as PermissionKey);
    else if (effect === "ALLOW") effective.add(permissionKey as PermissionKey);
  }
  return Array.from(effective);
}
