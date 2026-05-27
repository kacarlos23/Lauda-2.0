import { create } from "zustand";
import { adminService } from "../services/adminService";
import { GlobalMinistry, GlobalTenant, GlobalUser } from "../types";

interface AdminState {
  tenants: GlobalTenant[];
  users: GlobalUser[];
  ministries: GlobalMinistry[];
  loading: boolean;
  error: string | null;
  loadTenants: () => Promise<void>;
  loadDashboard: () => Promise<void>;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export const useAdminStore = create<AdminState>((set) => ({
  tenants: [],
  users: [],
  ministries: [],
  loading: false,
  error: null,

  loadTenants: async () => {
    set({ loading: true, error: null });
    try {
      const tenants = await adminService.getTenants();
      set({ tenants, loading: false, error: null });
    } catch (error) {
      set({
        loading: false,
        error: getErrorMessage(error, "Não foi possível carregar igrejas."),
      });
    }
  },

  loadDashboard: async () => {
    set({ loading: true, error: null });
    try {
      const [tenants, users, ministries] = await Promise.all([
        adminService.getTenants(),
        adminService.getGlobalUsers(),
        adminService.getGlobalMinistries(),
      ]);
      set({ tenants, users, ministries, loading: false, error: null });
    } catch (error) {
      set({
        loading: false,
        error: getErrorMessage(error, "Não foi possível carregar o painel global."),
      });
    }
  },
}));
