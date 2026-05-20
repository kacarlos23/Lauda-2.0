import { create } from "zustand";
import { AssignmentStatus, MySchedule } from "../types";
import { getMySchedules, updateAssignmentStatus } from "../services/scheduleService";
import { sortSchedulesByDate } from "../utils/scheduleFormat";

interface ScheduleState {
  mySchedules: MySchedule[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  loadMySchedules: () => Promise<void>;
  refreshMySchedules: () => Promise<void>;
  acceptAssignment: (scheduleId: string, assignmentId: string) => Promise<void>;
  declineAssignment: (scheduleId: string, assignmentId: string) => Promise<void>;
  clearError: () => void;
}

function friendlyError(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível atualizar suas escalas.";
}

function updateLocalStatus(
  schedules: MySchedule[],
  assignmentId: string,
  status: AssignmentStatus
): MySchedule[] {
  return schedules.map((item) =>
    item.assignmentId === assignmentId ? { ...item, status } : item
  );
}

async function changeAssignmentStatus(
  get: () => ScheduleState,
  set: (state: Partial<ScheduleState>) => void,
  scheduleId: string,
  assignmentId: string,
  status: AssignmentStatus
) {
  const previousSchedules = get().mySchedules;
  set({
    mySchedules: updateLocalStatus(previousSchedules, assignmentId, status),
    error: null,
  });

  try {
    await updateAssignmentStatus(scheduleId, assignmentId, status);
  } catch (error) {
    set({
      mySchedules: previousSchedules,
      error: friendlyError(error),
    });
  }
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  mySchedules: [],
  loading: false,
  refreshing: false,
  error: null,

  clearError: () => set({ error: null }),

  loadMySchedules: async () => {
    set({ loading: true, error: null });

    try {
      const schedules = await getMySchedules();
      set({ mySchedules: sortSchedulesByDate(schedules), loading: false });
    } catch (error) {
      set({ error: friendlyError(error), loading: false });
    }
  },

  refreshMySchedules: async () => {
    set({ refreshing: true, error: null });

    try {
      const schedules = await getMySchedules();
      set({ mySchedules: sortSchedulesByDate(schedules), refreshing: false });
    } catch (error) {
      set({ error: friendlyError(error), refreshing: false });
    }
  },

  acceptAssignment: async (scheduleId, assignmentId) => {
    await changeAssignmentStatus(get, set, scheduleId, assignmentId, "ACCEPTED");
  },

  declineAssignment: async (scheduleId, assignmentId) => {
    await changeAssignmentStatus(get, set, scheduleId, assignmentId, "DECLINED");
  },
}));

