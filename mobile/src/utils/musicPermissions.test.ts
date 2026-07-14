import { canManageMusic } from "./musicPermissions";

describe("canManageMusic", () => {
  it("permite GLOBAL_ADMIN", () => {
    expect(canManageMusic("GLOBAL_ADMIN")).toBe(true);
  });

  it("permite papéis de administração e liderança musical", () => {
    expect(canManageMusic("TENANT_ADMIN")).toBe(true);
    expect(canManageMusic("MINISTRY_LEADER")).toBe(true);
  });

  it("bloqueia membro sem grants e usuário ausente", () => {
    expect(canManageMusic("MEMBER")).toBe(false);
    expect(canManageMusic(undefined)).toBe(false);
  });

  it("permite usuário comum com grant explícito", () => {
    expect(canManageMusic({ role: "MEMBER", permissions: ["song:create"] })).toBe(true);
  });
});
