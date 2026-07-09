import { create } from "zustand";
import { Ministry, MinistryMember } from "../types";
import { ministryApi } from "../services/ministryApi";
import { invalidateRelatedData } from "./invalidation";

interface MinistryState {
  ministries: Ministry[];
  currentMinistry: Ministry | null;
  currentMembers: MinistryMember[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;

  fetchMinistries: () => Promise<void>;
  setRefreshing: (v: boolean) => void;
  fetchMinistry: (id: string) => Promise<void>;
  createMinistry: (data: { name: string; description?: string }) => Promise<void>;
  updateMinistry: (id: string, data: { name?: string; description?: string }) => Promise<void>;
  deleteMinistry: (id: string) => Promise<void>;
  addMember: (ministryId: string, userId: string, isLeader?: boolean) => Promise<void>;
  removeMember: (ministryId: string, userId: string) => Promise<void>;
  toggleMember: (ministryId: string, userId: string) => Promise<"linked" | "unlinked">;
  assignMember: (data: {
    ministryId: string;
    userId: string;
    role?: string;
    skills?: string[];
    status?: MinistryMember["status"];
    notes?: string;
    isLeader?: boolean;
  }) => Promise<void>;
  clearError: () => void;
}

export const useMinistryStore = create<MinistryState>((set, get) => ({
  ministries: [],
  currentMinistry: null,
  currentMembers: [],
  loading: false,
  refreshing: false,
  error: null,

  setRefreshing: (v) => set({ refreshing: v }),

  clearError: () => set({ error: null }),

  fetchMinistries: async () => {
    set({ loading: true, error: null });
    try {
      const ministries = await ministryApi.getMinistries();
      set({ ministries, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchMinistry: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const { ministry, members } = await ministryApi.getMinistry(id);
      set({ currentMinistry: ministry, currentMembers: members, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  createMinistry: async (data) => {
    set({ loading: true, error: null });
    const previousMinistries = get().ministries;
    try {
      const created = await ministryApi.createMinistry(data);
      set({
        ministries: [...previousMinistries, created].sort((a, b) =>
          a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
        ),
        loading: false,
        error: null,
      });
      await invalidateRelatedData({ reason: "ministry", ministryId: created.id });
    } catch (error: any) {
      set({ ministries: previousMinistries, error: error.message, loading: false });
      throw error;
    }
  },

  updateMinistry: async (id, data) => {
    set({ loading: true, error: null });
    const previousState = get();
    const optimisticMinistries = previousState.ministries.map((ministry) =>
      ministry.id === id ? { ...ministry, ...data } : ministry
    );
    const optimisticCurrent =
      previousState.currentMinistry?.id === id ? { ...previousState.currentMinistry, ...data } : previousState.currentMinistry;

    set({
      ministries: optimisticMinistries,
      currentMinistry: optimisticCurrent,
    });

    try {
      const updated = await ministryApi.updateMinistry(id, data);
      set({
        ministries: get().ministries.map((ministry) => (ministry.id === id ? updated : ministry)),
        currentMinistry: get().currentMinistry?.id === id ? updated : get().currentMinistry,
        loading: false,
        error: null,
      });
      await invalidateRelatedData({ reason: "ministry", ministryId: id });
    } catch (error: any) {
      set({
        ministries: previousState.ministries,
        currentMinistry: previousState.currentMinistry,
        currentMembers: previousState.currentMembers,
        error: error.message,
        loading: false,
      });
      throw error;
    }
  },

  deleteMinistry: async (id) => {
    set({ loading: true, error: null });
    const previousState = get();
    set({
      ministries: previousState.ministries.filter((ministry) => ministry.id !== id),
      currentMinistry: previousState.currentMinistry?.id === id ? null : previousState.currentMinistry,
      currentMembers: previousState.currentMinistry?.id === id ? [] : previousState.currentMembers,
    });
    try {
      await ministryApi.deleteMinistry(id);
      set({ loading: false, error: null });
      await invalidateRelatedData({ reason: "ministry", ministryId: id });
    } catch (error: any) {
      set({
        ministries: previousState.ministries,
        currentMinistry: previousState.currentMinistry,
        currentMembers: previousState.currentMembers,
        error: error.message,
        loading: false,
      });
      throw error;
    }
  },

  addMember: async (ministryId, userId, isLeader = false) => {
    set({ loading: true, error: null });
    try {
      await ministryApi.addMember(ministryId, userId, isLeader);
      if (get().currentMinistry?.id === ministryId) {
        await get().fetchMinistry(ministryId);
      }
      set({ loading: false, error: null });
      await invalidateRelatedData({ reason: "member", ministryId, userId });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  removeMember: async (ministryId, userId) => {
    set({ loading: true, error: null });
    try {
      await ministryApi.removeMember(ministryId, userId);
      if (get().currentMinistry?.id === ministryId) {
        await get().fetchMinistry(ministryId);
      }
      set({ loading: false, error: null });
      await invalidateRelatedData({ reason: "member", ministryId, userId });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  toggleMember: async (ministryId, userId) => {
    set({ error: null });
    try {
      const response = await ministryApi.toggleMinistryMember(ministryId, userId);
      if (get().currentMinistry?.id === ministryId) {
        await get().fetchMinistry(ministryId);
      }
      await invalidateRelatedData({ reason: "member", ministryId, userId });
      return response.status;
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  assignMember: async (data) => {
    set({ loading: true, error: null });
    try {
      await ministryApi.assignMember(data);
      if (get().currentMinistry?.id === data.ministryId) {
        await get().fetchMinistry(data.ministryId);
      }
      set({ loading: false, error: null });
      await invalidateRelatedData({ reason: "member", ministryId: data.ministryId, userId: data.userId });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
}));
