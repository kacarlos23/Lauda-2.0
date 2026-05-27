import { create } from "zustand";
import { adminService } from "../services/adminService";
import { GlobalTenant } from "../types";

interface AdminState {
  tenants: GlobalTenant[];
  loading: boolean;
  error: string | null;
  loadTenants: () => Promise<void>;
}

export const useAdminStore = create<AdminState>((set) => ({
  tenants: [],
  loading: false,
  error: null,

  loadTenants: async () => {
    set({ loading: true, error: null });
    try {
      const tenants = await adminService.getTenants();
      set({ tenants, loading: false, error: null });
    } catch (error) {
      set({
        tenants: [],
        loading: false,
        error: error instanceof Error ? error.message : "Não foi possível carregar igrejas.",
      });
    }
  },
}));
