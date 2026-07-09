import { create } from "zustand";
import { CreateMemberPayload, memberService, UpdateMemberPermissionsPayload } from "../services/memberService";
import { Member } from "../types";
import { invalidateRelatedData } from "./invalidation";

interface MemberState {
  members: Member[];
  loading: boolean;
  refreshing: boolean;
  saving: boolean;
  error: string | null;
  loadMembers: () => Promise<void>;
  createMember: (payload: CreateMemberPayload & { ministryId?: string; isLeader?: boolean }) => Promise<Member>;
  updatePermissions: (memberId: string, payload: UpdateMemberPermissionsPayload) => Promise<Member>;
  setRefreshing: (value: boolean) => void;
  clearError: () => void;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function sortMembers(members: Member[]): Member[] {
  return [...members].sort((first, second) =>
    first.name.localeCompare(second.name, "pt-BR", { sensitivity: "base" })
  );
}

export const useMemberStore = create<MemberState>((set, get) => ({
  members: [],
  loading: false,
  refreshing: false,
  saving: false,
  error: null,

  setRefreshing: (value) => set({ refreshing: value }),
  clearError: () => set({ error: null }),

  loadMembers: async () => {
    set({ loading: true, error: null });
    try {
      const members = await memberService.listMembers();
      set({ members: sortMembers(members), loading: false, error: null });
    } catch (error) {
      set({ loading: false, error: errorMessage(error, "Não foi possível carregar os membros.") });
    }
  },

  createMember: async ({ ministryId, isLeader = false, ...payload }) => {
    set({ saving: true, error: null });
    try {
      const member = await memberService.createMember(payload);
      if (ministryId) {
        await memberService.addMinistry(member.id, { ministryId, isLeader });
      }

      const nextMember = ministryId
        ? {
            ...member,
            ministries: [
              ...(member.ministries ?? []),
              { ministry: { id: ministryId, name: "" }, isLeader },
            ],
          }
        : member;

      set({ members: sortMembers([...get().members.filter((item) => item.id !== member.id), nextMember]), saving: false });
      await invalidateRelatedData({ reason: "member", ministryId, userId: member.id });
      return member;
    } catch (error) {
      set({ saving: false, error: errorMessage(error, "Erro ao cadastrar membro.") });
      throw error;
    }
  },

  updatePermissions: async (memberId, payload) => {
    const previousMembers = get().members;
    set({ saving: true, error: null });
    try {
      const updated = await memberService.updatePermissions(memberId, payload);
      set({
        members: sortMembers(previousMembers.map((member) => (member.id === updated.id ? updated : member))),
        saving: false,
        error: null,
      });
      const firstMinistryId = payload.ministries[0]?.ministryId;
      await invalidateRelatedData({ reason: "member", ministryId: firstMinistryId, userId: memberId });
      return updated;
    } catch (error) {
      set({
        members: previousMembers,
        saving: false,
        error: errorMessage(error, "Não foi possível atualizar as permissões."),
      });
      throw error;
    }
  },
}));
