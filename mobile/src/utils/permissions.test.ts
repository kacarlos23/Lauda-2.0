import {
  canAccessGlobalAdminArea,
  canManageChurch,
  canManageMembers,
  canViewMembers,
  formatRoleLabel,
  isGlobalAdmin,
  isTenantAdmin,
} from "./permissions";

describe("member permissions", () => {
  it("admin ve membros e acoes administrativas", () => {
    expect(canViewMembers("TENANT_ADMIN")).toBe(true);
    expect(canManageMembers("TENANT_ADMIN")).toBe(true);
    expect(canViewMembers("GLOBAL_ADMIN")).toBe(true);
    expect(canManageMembers("GLOBAL_ADMIN")).toBe(true);
  });

  it("lider ve membros sem acoes administrativas", () => {
    expect(canViewMembers("MINISTRY_LEADER")).toBe(true);
    expect(canManageMembers("MINISTRY_LEADER")).toBe(false);
  });

  it("membro comum nao ve a aba de membros", () => {
    expect(canViewMembers("MEMBER")).toBe(false);
    expect(canManageMembers("MEMBER")).toBe(false);
  });

  it("distingue admin global de administrador da igreja", () => {
    expect(isGlobalAdmin({ role: "GLOBAL_ADMIN" })).toBe(true);
    expect(isGlobalAdmin({ role: "TENANT_ADMIN" })).toBe(false);
    expect(isTenantAdmin({ role: "TENANT_ADMIN" })).toBe(true);
    expect(canAccessGlobalAdminArea("GLOBAL_ADMIN")).toBe(true);
    expect(canAccessGlobalAdminArea("TENANT_ADMIN")).toBe(false);
    expect(canAccessGlobalAdminArea("MINISTRY_LEADER")).toBe(false);
    expect(canAccessGlobalAdminArea("MEMBER")).toBe(false);
  });

  it("formata labels das roles", () => {
    expect(formatRoleLabel("GLOBAL_ADMIN")).toBe("Administrador global");
    expect(formatRoleLabel("TENANT_ADMIN")).toBe("Administrador da igreja");
    expect(formatRoleLabel("MINISTRY_LEADER")).toBe("Líder de ministério");
    expect(formatRoleLabel("MEMBER")).toBe("Membro");
    expect(canManageChurch("GLOBAL_ADMIN")).toBe(true);
    expect(canManageChurch("MEMBER")).toBe(false);
  });
});
