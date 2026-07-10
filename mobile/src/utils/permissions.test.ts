import {
  can,
  canAccessGlobalAdminArea,
  canAccessChurchAdmin,
  canManageChurch,
  canManageMembers,
  canViewMembers,
  formatRoleLabel,
  isGlobalAdmin,
  isTenantAdmin,
} from "./permissions";

describe("member permissions", () => {
  it("does not grant administrative permissions through tenant admin role", () => {
    expect(canViewMembers("TENANT_ADMIN")).toBe(false);
    expect(canManageMembers("TENANT_ADMIN")).toBe(false);
    expect(canViewMembers("GLOBAL_ADMIN")).toBe(true);
    expect(canManageMembers("GLOBAL_ADMIN")).toBe(true);
  });

  it("does not grant member access through ministry leader role", () => {
    expect(canViewMembers("MINISTRY_LEADER")).toBe(false);
    expect(canManageMembers("MINISTRY_LEADER")).toBe(false);
  });

  it("keeps common members without member admin access", () => {
    expect(canViewMembers("MEMBER")).toBe(false);
    expect(canManageMembers("MEMBER")).toBe(false);
  });

  it("distinguishes global admin from tenant-scoped grants", () => {
    expect(isGlobalAdmin({ role: "GLOBAL_ADMIN" })).toBe(true);
    expect(isGlobalAdmin({ role: "TENANT_ADMIN" })).toBe(false);
    expect(isTenantAdmin({ role: "TENANT_ADMIN" })).toBe(true);
    expect(canAccessGlobalAdminArea("GLOBAL_ADMIN")).toBe(true);
    expect(canAccessGlobalAdminArea("TENANT_ADMIN")).toBe(false);
    expect(canAccessGlobalAdminArea("MINISTRY_LEADER")).toBe(false);
    expect(canAccessGlobalAdminArea("MEMBER")).toBe(false);
    expect(canAccessChurchAdmin("TENANT_ADMIN")).toBe(false);
    expect(canAccessChurchAdmin("GLOBAL_ADMIN")).toBe(true);
    expect(canAccessChurchAdmin("MINISTRY_LEADER")).toBe(false);
    expect(canAccessChurchAdmin("MEMBER")).toBe(false);
  });

  it("formats role labels", () => {
    expect(formatRoleLabel("GLOBAL_ADMIN")).toBe("Administrador global");
    expect(formatRoleLabel("TENANT_ADMIN")).toBe("Administrador da igreja");
    expect(formatRoleLabel("MINISTRY_LEADER")).toBe("Líder de ministério");
    expect(formatRoleLabel("MEMBER")).toBe("Membro");
    expect(canManageChurch("GLOBAL_ADMIN")).toBe(true);
    expect(canManageChurch("MEMBER")).toBe(false);
  });

  it("respects explicit permissions without requiring an administrative role", () => {
    const memberWithSongCreate = {
      role: "MEMBER" as const,
      permissions: ["song:create" as const],
    };
    const memberWithScheduleEdit = {
      role: "MEMBER" as const,
      permissions: ["schedule:edit" as const],
    };

    expect(can(memberWithSongCreate, "song:create")).toBe(true);
    expect(can(memberWithSongCreate, "song:edit")).toBe(false);
    expect(can(memberWithScheduleEdit, "schedule:edit")).toBe(true);
    expect(can(memberWithScheduleEdit, "schedule:create")).toBe(false);
  });

  it("uses current effective user permissions to unlock screens", () => {
    const user = {
      role: "MEMBER" as const,
      permissions: ["member:view" as const, "ministry:create" as const],
    };

    expect(canViewMembers(user)).toBe(true);
    expect(canAccessChurchAdmin(user)).toBe(true);
    expect(canManageMembers(user)).toBe(false);
  });
});
