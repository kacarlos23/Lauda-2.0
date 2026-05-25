import { create } from "zustand";
import { AssignmentStatus, ScheduleAssignment } from "../types";
import { scheduleService } from "../services/scheduleService";

interface ScheduleState {
  schedules: ScheduleAssignment[];
  loading: boolean;
  error: string | null;
  loadMySchedules: () => Promise<void>;
  updateScheduleStatus: (
    scheduleId: string,
    assignmentId: string,
    status: AssignmentStatus
  ) => Promise<void>;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  schedules: [],
  loading: false,
  error: null,

  loadMySchedules: async () => {
    set({ loading: true, error: null });
    try {
      const schedules = await scheduleService.getMySchedules();
      set({ schedules, loading: false, error: null });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Não foi possível carregar escalas.",
      });
    }
  },

  updateScheduleStatus: async (scheduleId, assignmentId, status) => {
    set({ error: null });
    try {
      const updated = await scheduleService.updateAssignmentStatus(scheduleId, assignmentId, status);
      set({
        schedules: get().schedules.map((item) =>
          item.id === assignmentId ? { ...item, ...updated, schedule: updated.schedule ?? item.schedule } : item
        ),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível atualizar escala.";
      set({ error: message });
      throw error;
    }
  },
}));
