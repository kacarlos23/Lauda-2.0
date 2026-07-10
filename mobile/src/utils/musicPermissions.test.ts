import { canManageMusic } from "./musicPermissions";

describe("canManageMusic", () => {
  it("permite GLOBAL_ADMIN", () => {
    expect(canManageMusic("GLOBAL_ADMIN")).toBe(true);
  });

  it("bloqueia roles sem grants e usuário ausente", () => {
    expect(canManageMusic("TENANT_ADMIN")).toBe(false);
    expect(canManageMusic("MINISTRY_LEADER")).toBe(false);
    expect(canManageMusic("MEMBER")).toBe(false);
    expect(canManageMusic(undefined)).toBe(false);
  });

  it("permite usuário comum com grant explícito", () => {
    expect(canManageMusic({ role: "MEMBER", permissions: ["song:create"] })).toBe(true);
  });
});
