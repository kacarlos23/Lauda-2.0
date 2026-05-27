import { create } from "zustand";
import { churchService } from "../services/churchService";
import { ChurchOverview, ChurchSummary } from "../types";

interface ChurchState {
  summary: ChurchSummary | null;
  overview: ChurchOverview | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  loadChurch: () => Promise<void>;
  updateChurchName: (name: string) => Promise<void>;
  loadOverview: () => Promise<void>;
  clearError: () => void;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export const useChurchStore = create<ChurchState>((set, get) => ({
  summary: null,
  overview: null,
  loading: false,
  saving: false,
  error: null,

  loadChurch: async () => {
    set({ loading: true, error: null });
    try {
      const summary = await churchService.getMyChurch();
      set({ summary, loading: false, error: null });
    } catch (error) {
      set({ loading: false, error: errorMessage(error, "Não foi possível carregar os dados da igreja.") });
    }
  },

  updateChurchName: async (name: string) => {
    set({ saving: true, error: null });
    try {
      const summary = await churchService.updateMyChurch({ name });
      const overview = get().overview;
      set({
        summary,
        overview: overview ? { ...overview, tenant: { ...overview.tenant, name: summary.tenant.name } } : overview,
        saving: false,
        error: null,
      });
    } catch (error) {
      set({ saving: false, error: errorMessage(error, "Não foi possível salvar os dados da igreja.") });
      throw error;
    }
  },

  loadOverview: async () => {
    set({ loading: true, error: null });
    try {
      const overview = await churchService.getChurchOverview();
      set({ overview, loading: false, error: null });
    } catch (error) {
      set({ loading: false, error: errorMessage(error, "Não foi possível carregar os dados da igreja.") });
    }
  },

  clearError: () => set({ error: null }),
}));
