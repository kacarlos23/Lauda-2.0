import { sortMembersForToggle, toggleLinkedMemberIds } from "./ministryMemberToggle";
import { isChurchAdmin } from "./permissions";

describe("ministry member toggle helpers", () => {
  it("adiciona membro não vinculado de forma otimista", () => {
    expect(toggleLinkedMemberIds(["member-1"], "member-2")).toEqual(["member-1", "member-2"]);
  });

  it("remove membro vinculado de forma otimista", () => {
    expect(toggleLinkedMemberIds(["member-1", "member-2"], "member-1")).toEqual(["member-2"]);
  });

  it("ordena vinculados no topo e nomes alfabeticamente", () => {
    const members = [
      { id: "3", name: "Carlos" },
      { id: "2", name: "Ana" },
      { id: "1", name: "Bruno" },
    ];

    expect(sortMembersForToggle(members, ["1"]).map((member) => member.name)).toEqual([
      "Bruno",
      "Ana",
      "Carlos",
    ]);
  });

  it("identifica acesso da igreja por permissões efetivas", () => {
    expect(isChurchAdmin({ role: "TENANT_ADMIN" })).toBe(true);
    expect(isChurchAdmin({ role: "GLOBAL_ADMIN" })).toBe(true);
    expect(isChurchAdmin({ role: "MEMBER", permissions: ["member:create"] })).toBe(true);
    expect(isChurchAdmin({ role: "MINISTRY_LEADER" })).toBe(false);
    expect(isChurchAdmin({ role: "MEMBER" })).toBe(false);
    expect(isChurchAdmin(null)).toBe(false);
  });
});
