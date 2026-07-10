import { Role } from "@prisma/client";
import { rolePermissions } from "../../constants/permissions";
import { basePrisma } from "../../config/prisma";
import { effectivePermissionKeys, hasPermission } from "../../services/permissionService";

jest.mock("../../config/prisma", () => ({
  basePrisma: {
    userPermission: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

const userPermission = basePrisma.userPermission as jest.Mocked<typeof basePrisma.userPermission>;

describe("granular permission mappings", () => {
  it("keeps GLOBAL_ADMIN as the only role with permission management", () => {
    expect(rolePermissions(Role.GLOBAL_ADMIN)).toContain("permissions:manage");
    expect(rolePermissions(Role.TENANT_ADMIN)).not.toContain("permissions:manage");
    expect(rolePermissions(Role.MINISTRY_LEADER)).not.toContain("permissions:manage");
    expect(rolePermissions(Role.MEMBER)).not.toContain("permissions:manage");
  });

  it("allows specific operational permissions without granting full admin access", () => {
    expect(rolePermissions(Role.MEMBER)).toContain("schedule:respond");
    expect(rolePermissions(Role.MEMBER)).toContain("song:view");
    expect(rolePermissions(Role.MEMBER)).not.toContain("song:create");
    expect(rolePermissions(Role.MEMBER)).not.toContain("schedule:edit");
  });

  it("does not grant administrative permissions through tenant admin role", () => {
    expect(rolePermissions(Role.TENANT_ADMIN)).toContain("schedule:respond");
    expect(rolePermissions(Role.TENANT_ADMIN)).not.toContain("schedule:create");
    expect(rolePermissions(Role.TENANT_ADMIN)).not.toContain("song:edit");
    expect(rolePermissions(Role.TENANT_ADMIN)).not.toContain("tenant:manage");
    expect(rolePermissions(Role.TENANT_ADMIN)).not.toContain("member:assign_permissions");
  });

  it("checks explicit tenant-scoped grants for non-global users", async () => {
    userPermission.findFirst.mockResolvedValueOnce({ id: "grant-1" } as any);

    await expect(
      hasPermission({ id: "user-1", role: Role.MEMBER, tenantId: "tenant-a" }, "schedule:create", "tenant-a")
    ).resolves.toBe(true);

    expect(userPermission.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        permission: { key: "schedule:create" },
        tenantId: "tenant-a",
      },
      select: { id: true },
    });
  });

  it("denies removed grants and grants from other tenants", async () => {
    userPermission.findFirst.mockResolvedValue(null);

    await expect(
      hasPermission({ id: "user-1", role: Role.MEMBER, tenantId: "tenant-b" }, "schedule:create", "tenant-b")
    ).resolves.toBe(false);
  });

  it("returns only self-use defaults plus explicit tenant permissions", async () => {
    userPermission.findMany.mockResolvedValue([
      { permission: { key: "schedule:edit" } },
      { permission: { key: "song:create" } },
    ] as any);

    await expect(
      effectivePermissionKeys({ id: "user-1", role: Role.MEMBER, tenantId: "tenant-a" })
    ).resolves.toEqual(expect.arrayContaining(["schedule:respond", "song:view", "schedule:edit", "song:create"]));
  });
});
