import { Role } from "@prisma/client";
import { rolePermissions } from "../../constants/permissions";

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

  it("keeps tenant admin compatible while excluding global-only permissions", () => {
    expect(rolePermissions(Role.TENANT_ADMIN)).toContain("schedule:create");
    expect(rolePermissions(Role.TENANT_ADMIN)).toContain("song:edit");
    expect(rolePermissions(Role.TENANT_ADMIN)).not.toContain("tenant:manage");
    expect(rolePermissions(Role.TENANT_ADMIN)).not.toContain("member:assign_permissions");
  });
});
