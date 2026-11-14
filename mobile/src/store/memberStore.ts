import { create } from "zustand";
import { CreateMemberPayload, memberService, UpdateMemberPayload, UpdateMemberPermissionsPayload } from "../services/memberService";
import { Member } from "../types";
import { canViewMembers } from "../utils/permissions";
import { invalidateRelatedData } from "./invalidation";

const MEMBERS_CACHE_TTL_MS = 30_000;
let inFlightLoadMembers: Promise<void> | null = null;

interface MemberState {
  members: Member[];
  loading: boolean;
  refreshing: boolean;
  saving: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  loadMembers: (options?: { force?: boolean }) => Promise<void>;
  createMember: (payload: CreateMemberPayload & { ministryId?: string; isLeader?: boolean }) => Promise<Member>;
  updateMember: (memberId: string, payload: UpdateMemberPayload) => Promise<Member>;
  updatePermissions: (memberId: string, payload: UpdateMemberPermissionsPayload) => Promise<Member>;
  setRefreshing: (value: boolean) => void;
  clearError: () => void;
  reset: () => void;
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
  lastFetchedAt: null,

  setRefreshing: (value) => set({ refreshing: value }),
  clearError: () => set({ error: null }),
  reset: () => {
    inFlightLoadMembers = null;
    set({ members: [], loading: false, refreshing: false, saving: false, error: null, lastFetchedAt: null });
  },

  loadMembers: async (options) => {
    const authModule = require("./authStore") as typeof import("./authStore");
    const currentUser = authModule.useAuthStore?.getState?.().user ?? null;
    if (currentUser && !canViewMembers(currentUser)) {
      set({ loading: false, error: null });
      return;
    }

    const state = get();
    if (
      !options?.force &&
      state.lastFetchedAt !== null &&
      Date.now() - state.lastFetchedAt < MEMBERS_CACHE_TTL_MS &&
      state.members.length > 0
    ) {
      return;
    }

    if (!options?.force && inFlightLoadMembers) {
      return inFlightLoadMembers;
    }

    let requestPromise: Promise<void> | null = null;
    requestPromise = (async () => {
      set({ loading: state.members.length === 0, error: null });
      try {
        const members = await memberService.listMembers();
        set({ members: sortMembers(members), loading: false, error: null, lastFetchedAt: Date.now() });
      } catch (error) {
        set({ loading: false, error: errorMessage(error, "Não foi possível carregar os membros.") });
      } finally {
        if (requestPromise && inFlightLoadMembers === requestPromise) {
          inFlightLoadMembers = null;
        }
      }
    })();

    inFlightLoadMembers = requestPromise;
    return requestPromise;
  },

  createMember: async ({ ministryId, isLeader = false, ...payload }) => {
    set({ saving: true, error: null });
    try {
      const member = await memberService.createMember({
        ...payload,
        ...(ministryId ? { ministryId, isLeader } : {}),
      });

      const nextMember = ministryId && (!member.ministries || member.ministries.length === 0)
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
      return nextMember;
    } catch (error) {
      set({ saving: false, error: errorMessage(error, "Erro ao cadastrar membro.") });
      throw error;
    }
  },

  updateMember: async (memberId, payload) => {
    const previousMembers = get().members;
    set({ saving: true, error: null });
    try {
      const updated = await memberService.updateMember(memberId, payload);
      set({
        members: sortMembers(previousMembers.map((member) => (member.id === updated.id ? { ...member, ...updated } : member))),
        saving: false,
        error: null,
      });
      await invalidateRelatedData({ reason: "member", userId: memberId });
      return updated;
    } catch (error) {
      set({
        members: previousMembers,
        saving: false,
        error: errorMessage(error, "Não foi possível atualizar o membro."),
      });
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
