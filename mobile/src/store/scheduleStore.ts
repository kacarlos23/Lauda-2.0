import { create } from "zustand";
import { AssignmentStatus, Schedule, ScheduleAssignment } from "../types";
import { scheduleService } from "../services/scheduleService";

interface ScheduleState {
  allSchedules: Schedule[];
  schedules: ScheduleAssignment[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  loadSchedules: () => Promise<void>;
  loadMySchedules: () => Promise<void>;
  createSchedule: (payload: {
    title: string;
    date: string;
    ministryId: string;
    songIds: string[];
    assignments: Array<{ userId: string; role: string }>;
  }) => Promise<Schedule>;
  updateSchedule: (id: string, payload: {
    title: string;
    date: string;
    ministryId: string;
    songIds: string[];
    assignments: Array<{ userId: string; role: string; status?: AssignmentStatus }>;
  }) => Promise<Schedule>;
  updateScheduleStatus: (
    scheduleId: string,
    assignmentId: string,
    status: AssignmentStatus
  ) => Promise<void>;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  allSchedules: [],
  schedules: [],
  loading: false,
  saving: false,
  error: null,

  loadSchedules: async () => {
    set({ loading: true, error: null });
    try {
      const schedules = await scheduleService.listSchedules();
      set({ allSchedules: schedules, loading: false, error: null });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Não foi possível carregar escalas.",
      });
    }
  },

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

  createSchedule: async (payload) => {
    set({ saving: true, error: null });
    try {
      const schedule = await scheduleService.createSchedule(payload);
      set({ saving: false, allSchedules: [...get().allSchedules, schedule].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) });
      return schedule;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível criar escala.";
      set({ saving: false, error: message });
      throw error;
    }
  },

  updateSchedule: async (id, payload) => {
    set({ saving: true, error: null });
    try {
      const schedule = await scheduleService.updateSchedule(id, payload);
      set({
        saving: false,
        allSchedules: get().allSchedules
          .map((item) => item.id === id ? schedule : item)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      });
      return schedule;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível atualizar escala.";
      set({ saving: false, error: message });
      throw error;
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
