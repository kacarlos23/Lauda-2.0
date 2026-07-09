import { buildPublicInviteLink, normalizeInviteCode } from "./memberInvite";

describe("memberInvite utils", () => {
  it("monta link publico correto quando API devolve link antigo", () => {
    expect(buildPublicInviteLink({ code: "ABCD-1234", inviteLink: "lauda://member-register?code=ABCD-1234" }))
      .toBe("https://laudaapp.com/convite?code=ABCD-1234");
  });

  it("corrige dominio temporario lauda.app para laudaapp.com", () => {
    expect(buildPublicInviteLink({ code: "ABCD-1234", inviteLink: "https://lauda.app/convite?code=ABCD-1234" }))
      .toBe("https://laudaapp.com/convite?code=ABCD-1234");
  });

  it("preserva link publico http existente quando ja e valido", () => {
    expect(buildPublicInviteLink({ code: "WXYZ-9876", inviteLink: "https://laudaapp.com/convite?code=WXYZ-9876" }))
      .toBe("https://laudaapp.com/convite?code=WXYZ-9876");
  });

  it("normaliza codigo novo sem alterar codigos legados", () => {
    expect(normalizeInviteCode("abcd-1234")).toBe("ABCD-1234");
    expect(normalizeInviteCode("legacy_invite_code_123")).toBe("legacy_invite_code_123");
  });
});
