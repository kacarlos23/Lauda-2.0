import { canManageMembers, canViewMembers } from "./permissions";

describe("member permissions", () => {
  it("admin vê membros e ações administrativas", () => {
    expect(canViewMembers("TENANT_ADMIN")).toBe(true);
    expect(canManageMembers("TENANT_ADMIN")).toBe(true);
    expect(canViewMembers("GLOBAL_ADMIN")).toBe(true);
    expect(canManageMembers("GLOBAL_ADMIN")).toBe(true);
  });

  it("líder vê membros sem ações administrativas", () => {
    expect(canViewMembers("MINISTRY_LEADER")).toBe(true);
    expect(canManageMembers("MINISTRY_LEADER")).toBe(false);
  });

  it("membro comum não vê a aba de membros", () => {
    expect(canViewMembers("MEMBER")).toBe(false);
    expect(canManageMembers("MEMBER")).toBe(false);
  });
});
