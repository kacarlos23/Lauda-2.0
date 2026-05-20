import { create } from "zustand";
import { Ministry, MinistryMember } from "../types";
import { ministryApi } from "../services/ministryApi";

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
    try {
      await ministryApi.createMinistry(data);
      await get().fetchMinistries(); // Refresh list
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  updateMinistry: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await ministryApi.updateMinistry(id, data);
      await get().fetchMinistries();
      if (get().currentMinistry?.id === id) {
        await get().fetchMinistry(id);
      }
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  deleteMinistry: async (id) => {
    set({ loading: true, error: null });
    try {
      await ministryApi.deleteMinistry(id);
      await get().fetchMinistries();
      if (get().currentMinistry?.id === id) {
        set({ currentMinistry: null, currentMembers: [] });
      }
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  addMember: async (ministryId, userId, isLeader = false) => {
    set({ loading: true, error: null });
    try {
      await ministryApi.addMember(ministryId, userId, isLeader);
      if (get().currentMinistry?.id === ministryId) {
        await get().fetchMinistry(ministryId);
      }
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  removeMember: async (ministryId, userId) => {
    set({ loading: true, error: null });
    try {
      await ministryApi.removeMember(ministryId, userId);
      if (get().currentMinistry?.id === ministryId) {
        await get().fetchMinistry(ministryId);
      }
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
}));
