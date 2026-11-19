jest.mock("../services/memberService", () => ({
  memberService: {
    addMinistry: jest.fn(),
    createMember: jest.fn(),
    listMembers: jest.fn(),
    updateMember: jest.fn(),
    updatePermissions: jest.fn(),
  },
}));

let mockAuthUser: { role: string; permissions?: string[]; ministries?: Array<{ ministryId: string; isLeader: boolean }> } | null = null;

jest.mock("./authStore", () => ({
  useAuthStore: {
    getState: jest.fn(() => ({ user: mockAuthUser })),
  },
}));

jest.mock("./invalidation", () => ({
  invalidateRelatedData: jest.fn(() => Promise.resolve()),
  resetAllDomainStores: jest.fn(),
}));

import { memberService } from "../services/memberService";
import { Member } from "../types";
import { invalidateRelatedData } from "./invalidation";
import { useMemberStore } from "./memberStore";

const mockedMemberService = memberService as jest.Mocked<typeof memberService>;
const mockedInvalidateRelatedData = invalidateRelatedData as jest.MockedFunction<typeof invalidateRelatedData>;
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
    mockAuthUser = null;
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

  it("cria membro vinculado ao ministério em chamada única atômica e invalida relacionados", async () => {
    const memberWithMinistry: Member = {
      ...member,
      ministries: [{ ministry: { id: "ministry-1", name: "Louvor" }, isLeader: true }],
    };
    mockedMemberService.createMember.mockResolvedValueOnce(memberWithMinistry);

    await useMemberStore.getState().createMember({
      name: member.name,
      email: member.email!,
      password: "secret123",
      role: "MEMBER",
      ministryId: "ministry-1",
      isLeader: true,
    });

    expect(mockedMemberService.createMember).toHaveBeenCalledWith({
      name: member.name,
      email: member.email!,
      password: "secret123",
      role: "MEMBER",
      ministryId: "ministry-1",
      isLeader: true,
    });
    expect(mockedMemberService.addMinistry).not.toHaveBeenCalled();
    expect(useMemberStore.getState().members[0].id).toBe(member.id);
    expect(useMemberStore.getState().members[0].ministries).toEqual(memberWithMinistry.ministries);
  });

  it("reset limpa a lista de membros e erros", () => {
    useMemberStore.setState({ members: [member], error: "Erro" });
    useMemberStore.getState().reset();
    expect(useMemberStore.getState().members).toEqual([]);
    expect(useMemberStore.getState().error).toBeNull();
  });

  it("faz rollback ao falhar atualização de permissões", async () => {
    useMemberStore.setState({ members: [member] });
    mockedMemberService.updatePermissions.mockRejectedValueOnce(new Error("Falha"));

    await expect(
      useMemberStore.getState().updatePermissions(member.id, { role: "MEMBER", ministries: [] })
    ).rejects.toThrow("Falha");

    expect(useMemberStore.getState().members).toEqual([member]);
  });

  it("invalida todos os ministérios afetados (novos e anteriores) ao atualizar permissões", async () => {
    const memberWithMinistries: Member = {
      ...member,
      ministries: [
        { ministry: { id: "ministry-1", name: "Louvor" }, isLeader: false },
        { ministry: { id: "ministry-2", name: "Mídia" }, isLeader: true },
      ],
    };
    const updatedMember: Member = {
      ...member,
      ministries: [
        { ministry: { id: "ministry-2", name: "Mídia" }, isLeader: false },
        { ministry: { id: "ministry-3", name: "Som" }, isLeader: true },
      ],
    };
    useMemberStore.setState({ members: [memberWithMinistries] });
    mockedMemberService.updatePermissions.mockResolvedValueOnce(updatedMember);

    await useMemberStore.getState().updatePermissions(member.id, {
      role: "MEMBER",
      ministries: [
        { ministryId: "ministry-2", isLeader: false },
        { ministryId: "ministry-3", isLeader: true },
      ],
    });

    expect(mockedInvalidateRelatedData).toHaveBeenCalledWith({
      reason: "member",
      ministryId: "ministry-2",
      ministryIds: ["ministry-2", "ministry-3", "ministry-1"],
      userId: member.id,
    });
  });

  it("atualiza dados do membro mantendo ordenação na store", async () => {
    const updated = { ...member, comments: "Observação atualizada" };
    useMemberStore.setState({ members: [member] });
    mockedMemberService.updateMember.mockResolvedValueOnce(updated);

    await useMemberStore.getState().updateMember(member.id, { comments: "Observação atualizada" });

    expect(mockedMemberService.updateMember).toHaveBeenCalledWith(member.id, { comments: "Observação atualizada" });
    expect(useMemberStore.getState().members[0].comments).toBe("Observação atualizada");
  });

  it("reaproveita cache TTL em chamadas repetidas e força atualização quando solicitado", async () => {
    mockedMemberService.listMembers.mockResolvedValue([member]);

    await useMemberStore.getState().loadMembers();
    await useMemberStore.getState().loadMembers();
    expect(mockedMemberService.listMembers).toHaveBeenCalledTimes(1);

    await useMemberStore.getState().loadMembers({ force: true });
    expect(mockedMemberService.listMembers).toHaveBeenCalledTimes(2);
  });

  it("deduplica requisições simultâneas de loadMembers", async () => {
    let resolveList!: (value: Member[]) => void;
    mockedMemberService.listMembers.mockImplementationOnce(
      () => new Promise<Member[]>((resolve) => {
        resolveList = resolve;
      }),
    );

    const first = useMemberStore.getState().loadMembers();
    const second = useMemberStore.getState().loadMembers();
    resolveList([member]);
    await Promise.all([first, second]);

    expect(mockedMemberService.listMembers).toHaveBeenCalledTimes(1);
    expect(useMemberStore.getState().members).toEqual([member]);
  });

  it("não baixa lista de membros quando o usuário logado não possui permissão de leitura", async () => {
    mockAuthUser = { role: "MEMBER", permissions: [] };

    await useMemberStore.getState().loadMembers();

    expect(mockedMemberService.listMembers).not.toHaveBeenCalled();
    expect(useMemberStore.getState().loading).toBe(false);
    expect(useMemberStore.getState().error).toBeNull();
  });
});
