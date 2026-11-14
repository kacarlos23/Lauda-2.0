import { create } from "zustand";
import { adminService } from "../services/adminService";
import { AdminResourceListResponse, GlobalMinistry, GlobalResourceName, GlobalSchedule, GlobalSong, GlobalTenant, GlobalUser } from "../types";

type AdminSectionPagination = AdminResourceListResponse<unknown>["pagination"];

const DEFAULT_SECTION_PAGINATION: AdminSectionPagination = {
  page: 1,
  limit: 25,
  total: 0,
  totalPages: 1,
};

interface AdminState {
  tenants: GlobalTenant[];
  users: GlobalUser[];
  ministries: GlobalMinistry[];
  songs: GlobalSong[];
  schedules: GlobalSchedule[];
  activeSection: GlobalResourceName;
  sectionItems: Record<string, Record<string, unknown>[]>;
  pagination: Record<string, AdminSectionPagination>;
  sectionLoading: boolean;
  loading: boolean;
  error: string | null;
  loadTenants: () => Promise<void>;
  loadDashboard: () => Promise<void>;
  loadSection: (
    section: GlobalResourceName,
    params?: { tenantId?: string; search?: string; page?: number; limit?: number }
  ) => Promise<AdminResourceListResponse<Record<string, unknown>>>;
  reset: () => void;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export const useAdminStore = create<AdminState>((set) => ({
  tenants: [],
  users: [],
  ministries: [],
  songs: [],
  schedules: [],
  activeSection: "tenants",
  sectionItems: {},
  pagination: {},
  sectionLoading: false,
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
      const [tenants, users, ministries, songs, schedules] = await Promise.all([
        adminService.getTenants(),
        adminService.getGlobalUsers(),
        adminService.getGlobalMinistries(),
        adminService.getGlobalSongs(),
        adminService.getGlobalSchedules(),
      ]);
      set({ tenants, users, ministries, songs, schedules, loading: false, error: null });
    } catch (error) {
      set({
        loading: false,
        error: getErrorMessage(error, "Não foi possível carregar o painel global."),
      });
    }
  },

  loadSection: async (section, params) => {
    set({ activeSection: section, sectionLoading: true, error: null });
    try {
      const response = await adminService.getResource<Record<string, unknown>>(section, {
        tenantId: params?.tenantId,
        search: params?.search,
        page: params?.page ?? 1,
        limit: params?.limit ?? DEFAULT_SECTION_PAGINATION.limit,
      });
      set((state) => ({
        sectionItems: { ...state.sectionItems, [section]: response.items },
        pagination: { ...state.pagination, [section]: response.pagination },
        ...(section === "tenants" ? { tenants: response.items as unknown as GlobalTenant[] } : {}),
        ...(section === "users" ? { users: response.items as unknown as GlobalUser[] } : {}),
        ...(section === "ministries" ? { ministries: response.items as unknown as GlobalMinistry[] } : {}),
        ...(section === "songs" ? { songs: response.items as unknown as GlobalSong[] } : {}),
        ...(section === "schedules" ? { schedules: response.items as unknown as GlobalSchedule[] } : {}),
        sectionLoading: false,
        error: null,
      }));
      return response;
    } catch (error) {
      set({
        sectionLoading: false,
        error: getErrorMessage(error, "Não foi possível carregar dados."),
      });
      throw error;
    }
  },

  reset: () => set({
    tenants: [],
    users: [],
    ministries: [],
    songs: [],
    schedules: [],
    activeSection: "tenants",
    sectionItems: {},
    pagination: {},
    sectionLoading: false,
    loading: false,
    error: null,
  }),
}));
