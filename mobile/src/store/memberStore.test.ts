jest.mock("../services/memberService", () => ({
  memberService: {
    addMinistry: jest.fn(),
    createMember: jest.fn(),
    listMembers: jest.fn(),
    updatePermissions: jest.fn(),
  },
}));

jest.mock("./invalidation", () => ({
  invalidateRelatedData: jest.fn(() => Promise.resolve()),
}));

import { memberService } from "../services/memberService";
import { Member } from "../types";
import { useMemberStore } from "./memberStore";

const mockedMemberService = memberService as jest.Mocked<typeof memberService>;
const initialState = useMemberStore.getState();

const member: Member = {
  id: "member-1",
  name: "Ana",
  email: "ana@example.com",
  role: "MEMBER",
  tenantId: "tenant-1",
  ministries: [],
  instruments: [],
};

describe("memberStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useMemberStore.setState(initialState, true);
  });

  it("cria membro e adiciona na lista global", async () => {
    mockedMemberService.createMember.mockResolvedValueOnce(member);

    await useMemberStore.getState().createMember({
      name: member.name,
      email: member.email!,
      password: "secret123",
      role: "MEMBER",
    });

    expect(mockedMemberService.createMember).toHaveBeenCalled();
    expect(useMemberStore.getState().members).toEqual([member]);
  });

  it("cria membro vinculado ao ministério e invalida relacionados", async () => {
    mockedMemberService.createMember.mockResolvedValueOnce(member);
    mockedMemberService.addMinistry.mockResolvedValueOnce();

    await useMemberStore.getState().createMember({
      name: member.name,
      email: member.email!,
      password: "secret123",
      role: "MEMBER",
      ministryId: "ministry-1",
      isLeader: true,
    });

    expect(mockedMemberService.addMinistry).toHaveBeenCalledWith(member.id, {
      ministryId: "ministry-1",
      isLeader: true,
    });
    expect(useMemberStore.getState().members[0].id).toBe(member.id);
  });

  it("faz rollback ao falhar atualização de permissões", async () => {
    useMemberStore.setState({ members: [member] });
    mockedMemberService.updatePermissions.mockRejectedValueOnce(new Error("Falha"));

    await expect(
      useMemberStore.getState().updatePermissions(member.id, { role: "MEMBER", ministries: [] })
    ).rejects.toThrow("Falha");

    expect(useMemberStore.getState().members).toEqual([member]);
  });
});
