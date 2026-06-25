import { canManageMusic } from "./musicPermissions";

describe("canManageMusic", () => {
  it.each(["GLOBAL_ADMIN", "TENANT_ADMIN", "MINISTRY_LEADER"] as const)("permite %s", (role) => {
    expect(canManageMusic(role)).toBe(true);
  });

  it("bloqueia MEMBER e usuário ausente", () => {
    expect(canManageMusic("MEMBER")).toBe(false);
    expect(canManageMusic(undefined)).toBe(false);
  });
});
