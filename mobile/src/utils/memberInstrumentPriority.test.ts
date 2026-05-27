import { Member } from "../types";
import { memberMatchesRoleInstrument, prioritizeMembersByRole } from "./memberInstrumentPriority";

function makeMember(name: string, instruments: Array<{ id: string; name: string }> = []): Member {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    role: "MEMBER",
    tenantId: "tenant-1",
    instruments,
    ministries: [],
  };
}

describe("prioritizeMembersByRole", () => {
  it("teclado prioriza membros com Teclado", () => {
    const members = [
      makeMember("Bruno", [{ id: "guitar", name: "Guitarra" }]),
      makeMember("Ana", [{ id: "keys", name: "Teclado" }]),
      makeMember("Carlos"),
    ];

    expect(prioritizeMembersByRole(members, "Teclado").map((member) => member.name)).toEqual([
      "Ana",
      "Bruno",
      "Carlos",
    ]);
  });

  it("baterista prioriza membros com Bateria", () => {
    const members = [
      makeMember("Ana", [{ id: "vocal", name: "Vocal" }]),
      makeMember("Bruno", [{ id: "drums", name: "Bateria" }]),
    ];

    expect(prioritizeMembersByRole(members, "baterista").map((member) => member.name)).toEqual(["Bruno", "Ana"]);
  });

  it("vocalista prioriza membros com Vocal", () => {
    const members = [
      makeMember("Davi", [{ id: "bass", name: "Baixo" }]),
      makeMember("Clara", [{ id: "voice", name: "Vocal" }]),
    ];

    expect(prioritizeMembersByRole(members, "Vocalista").map((member) => member.name)).toEqual(["Clara", "Davi"]);
  });

  it("sem roleText retorna ordenado por nome", () => {
    const members = [makeMember("Zoe"), makeMember("Álvaro"), makeMember("Bruno")];

    expect(prioritizeMembersByRole(members, "  ").map((member) => member.name)).toEqual(["Álvaro", "Bruno", "Zoe"]);
  });

  it("mantem todos os membros", () => {
    const members = [makeMember("Ana", [{ id: "keys", name: "Teclado" }]), makeMember("Bruno"), makeMember("Clara")];

    expect(prioritizeMembersByRole(members, "tecladista")).toHaveLength(3);
  });

  it("não altera array original", () => {
    const members = [makeMember("Bruno"), makeMember("Ana", [{ id: "keys", name: "Teclado" }])];
    const originalOrder = members.map((member) => member.name);

    prioritizeMembersByRole(members, "teclado");

    expect(members.map((member) => member.name)).toEqual(originalOrder);
  });

  it("normaliza acentos nas equivalencias", () => {
    const member = makeMember("Rita", [{ id: "reception", name: "Recepção" }]);

    expect(memberMatchesRoleInstrument(member, "recepcionista")).toBe(true);
  });
});
