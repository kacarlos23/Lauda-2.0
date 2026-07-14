import { PermissionEffect, Role } from "@prisma/client";
import { rolePermissions } from "../../constants/permissions";
import { basePrisma } from "../../config/prisma";
import { effectivePermissionKeys, hasPermission } from "../../services/permissionService";

jest.mock("../../config/prisma", () => ({
  basePrisma: { userPermission: { findMany: jest.fn() } },
}));

const userPermission = basePrisma.userPermission as jest.Mocked<typeof basePrisma.userPermission>;

describe("granular permission mappings", () => {
  beforeEach(() => userPermission.findMany.mockReset());

  it("keeps permission management exclusive to GLOBAL_ADMIN", () => {
    expect(rolePermissions(Role.GLOBAL_ADMIN)).toContain("permissions:manage");
    expect(rolePermissions(Role.TENANT_ADMIN)).not.toContain("permissions:manage");
    expect(rolePermissions(Role.MINISTRY_LEADER)).not.toContain("permissions:manage");
    expect(rolePermissions(Role.MEMBER)).not.toContain("permissions:manage");
  });

  it("gives tenant admins the complete operational baseline", () => {
    expect(rolePermissions(Role.TENANT_ADMIN)).toEqual(expect.arrayContaining([
      "schedule:create", "schedule:edit", "song:edit", "member:manage_access", "tenant:manage",
    ]));
    expect(rolePermissions(Role.TENANT_ADMIN)).not.toContain("permissions:manage");
  });

  it("applies ALLOW overrides inside the user's tenant", async () => {
    userPermission.findMany.mockResolvedValueOnce([{
      effect: PermissionEffect.ALLOW,
      permission: { key: "schedule:edit", assignable: true },
    }] as any);

    await expect(hasPermission(
      { id: "user-1", role: Role.MEMBER, tenantId: "tenant-a" },
      "schedule:edit",
      "tenant-a"
    )).resolves.toBe(true);
    expect(userPermission.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-1", tenantId: "tenant-a" },
    }));
  });

  it("applies DENY after an inherited permission", async () => {
    userPermission.findMany.mockResolvedValueOnce([{
      effect: PermissionEffect.DENY,
      permission: { key: "song:view", assignable: true },
    }] as any);

    await expect(effectivePermissionKeys(
      { id: "user-1", role: Role.MEMBER, tenantId: "tenant-a" }
    )).resolves.not.toContain("song:view");
  });

  it("combines defaults, allows and denies deterministically", async () => {
    userPermission.findMany.mockResolvedValueOnce([
      { effect: PermissionEffect.ALLOW, permission: { key: "song:create", assignable: true } },
      { effect: PermissionEffect.DENY, permission: { key: "schedule:respond", assignable: true } },
      { effect: PermissionEffect.ALLOW, permission: { key: "permissions:manage", assignable: false } },
    ] as any);

    const effective = await effectivePermissionKeys(
      { id: "user-1", role: Role.MEMBER, tenantId: "tenant-a" }
    );
    expect(effective).toEqual(expect.arrayContaining(["song:view", "song:create"]));
    expect(effective).not.toContain("permissions:manage");
  });

  it("uses the effective set already attached to the request", async () => {
    await expect(hasPermission(
      { id: "user-1", role: Role.MEMBER, tenantId: "tenant-a", permissions: [] },
      "song:view"
    )).resolves.toBe(false);
    expect(userPermission.findMany).not.toHaveBeenCalled();
  });
});
