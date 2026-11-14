import type { ScheduleSongDetails, WorshipPeriod } from "../types";
import { create } from "zustand";
import { AssignmentStatus, Schedule, ScheduleAssignment } from "../types";
import { ScheduleListParams, scheduleService } from "../services/scheduleService";
import { invalidateRelatedData } from "./invalidation";

type ScheduleDateRange = { dateFrom: string; dateTo: string };
type LoadOptions = { refresh?: boolean; params?: ScheduleListParams; persistParams?: boolean };

function mergeLoadedRange(
  current: ScheduleDateRange | null,
  params?: ScheduleListParams
): ScheduleDateRange | null {
  if (!params?.dateFrom || !params?.dateTo) return current;
  if (!current) return { dateFrom: params.dateFrom, dateTo: params.dateTo };
  return {
    dateFrom: params.dateFrom < current.dateFrom ? params.dateFrom : current.dateFrom,
    dateTo: params.dateTo > current.dateTo ? params.dateTo : current.dateTo,
  };
}

interface ScheduleState {
  allSchedules: Schedule[];
  schedules: ScheduleAssignment[];
  activeParams?: ScheduleListParams;
  myActiveParams?: ScheduleListParams;
  loadedRange: ScheduleDateRange | null;
  loading: boolean;
  schedulesLoading: boolean;
  mySchedulesLoading: boolean;
  refreshing: boolean;
  refreshingRequests: number;
  saving: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  requestedSchedulesKey: number;
  requestedMySchedulesKey: number;
  loadSchedules: (options?: LoadOptions) => Promise<void>;
  loadMySchedules: (options?: LoadOptions) => Promise<void>;
  createSchedule: (payload: {
    title: string;
    date: string;
    comments?: string | null;
    ministryId: string;
    songIds: string[];
    songDetails?: ScheduleSongDetails[];
    worshipPeriod?: WorshipPeriod;
    assignments: Array<{ userId: string; role: string }>;
  }) => Promise<Schedule>;
  updateSchedule: (id: string, payload: {
    title: string;
    date: string;
    comments?: string | null;
    ministryId: string;
    songIds: string[];
    songDetails?: ScheduleSongDetails[];
    worshipPeriod?: WorshipPeriod;
    assignments: Array<{ userId: string; role: string }>;
  }) => Promise<Schedule>;
  deleteSchedule: (id: string) => Promise<void>;
  updateScheduleStatus: (
    scheduleId: string,
    assignmentId: string,
    status: AssignmentStatus,
    options?: { declineReason?: string; requestSubstitute?: boolean }
  ) => Promise<void>;
  resolveSubstitution: (scheduleId: string, assignmentId: string, note?: string) => Promise<void>;
  reset: () => void;
}

function sortSchedules(schedules: Schedule[]): Schedule[] {
  return [...schedules].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function applyAssignmentToSchedules(schedules: Schedule[], assignment: ScheduleAssignment): Schedule[] {
  return schedules.map((schedule) => {
    if (schedule.id !== assignment.scheduleId) return schedule;
    return {
      ...schedule,
      assignments: schedule.assignments?.map((item) => item.id === assignment.id ? { ...item, ...assignment } : item),
    };
  });
}

type InFlightScheduleRequest = {
  key: string;
  promise: Promise<void>;
};

let inFlightLoadSchedules: InFlightScheduleRequest | null = null;
let inFlightLoadMySchedules: InFlightScheduleRequest | null = null;

function serializeScheduleParams(params?: ScheduleListParams): string {
  if (!params) return "{}";
  const normalized: Record<string, unknown> = {};
  for (const key of Object.keys(params).sort()) {
    const value = (params as Record<string, unknown>)[key];
    if (value !== undefined) normalized[key] = value;
  }
  return JSON.stringify(normalized);
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  allSchedules: [],
  schedules: [],
  activeParams: undefined,
  myActiveParams: undefined,
  loadedRange: null,
  loading: false,
  schedulesLoading: false,
  mySchedulesLoading: false,
  refreshing: false,
  refreshingRequests: 0,
  saving: false,
  error: null,
  lastFetchedAt: null,
  requestedSchedulesKey: 0,
  requestedMySchedulesKey: 0,

  loadSchedules: async (options) => {
    const hasExplicitParams = options?.params !== undefined;
    const effectiveParams = hasExplicitParams ? options?.params : get().activeParams;
    const paramKey = serializeScheduleParams(effectiveParams);
    if (!options?.refresh && inFlightLoadSchedules && inFlightLoadSchedules.key === paramKey) {
      return inFlightLoadSchedules.promise;
    }

    const requestKey = get().requestedSchedulesKey + 1;
    const shouldRefresh = Boolean(options?.refresh) || get().allSchedules.length > 0;
    const shouldPersistParams = hasExplicitParams && options?.persistParams !== false;
    set((state) => ({
      requestedSchedulesKey: requestKey,
      ...(shouldPersistParams
        ? {
            activeParams: options?.params,
            loadedRange: mergeLoadedRange(state.loadedRange, options?.params),
          }
        : {}),
      schedulesLoading: !shouldRefresh,
      loading: !shouldRefresh || state.mySchedulesLoading,
      refreshingRequests: state.refreshingRequests + (shouldRefresh ? 1 : 0),
      refreshing: shouldRefresh ? true : state.refreshing,
      error: null,
    }));
    let requestPromise: Promise<void> | null = null;
    requestPromise = (async () => {
      try {
        const schedules = await scheduleService.listSchedules(effectiveParams);
        set((state) => {
          const refreshingRequests = Math.max(0, state.refreshingRequests - (shouldRefresh ? 1 : 0));
          if (state.requestedSchedulesKey !== requestKey) {
            return { refreshingRequests, refreshing: refreshingRequests > 0 };
          }
          return {
            allSchedules: sortSchedules(schedules),
            schedulesLoading: false,
            loading: state.mySchedulesLoading,
            refreshingRequests,
            refreshing: refreshingRequests > 0,
            error: null,
            lastFetchedAt: Date.now(),
          };
        });
      } catch (error) {
        set((state) => {
          const refreshingRequests = Math.max(0, state.refreshingRequests - (shouldRefresh ? 1 : 0));
          if (state.requestedSchedulesKey !== requestKey) {
            return { refreshingRequests, refreshing: refreshingRequests > 0 };
          }
          return {
            schedulesLoading: false,
            loading: state.mySchedulesLoading,
            refreshingRequests,
            refreshing: refreshingRequests > 0,
            error: message(error, "Não foi possível carregar escalas."),
          };
        });
      } finally {
        if (inFlightLoadSchedules?.promise === requestPromise) {
          inFlightLoadSchedules = null;
        }
      }
    })();

    inFlightLoadSchedules = { key: paramKey, promise: requestPromise };
    return requestPromise;
  },

  loadMySchedules: async (options) => {
    const hasExplicitParams = options?.params !== undefined;
    const effectiveParams = hasExplicitParams ? options?.params : get().myActiveParams;
    const paramKey = serializeScheduleParams(effectiveParams);
    if (!options?.refresh && inFlightLoadMySchedules && inFlightLoadMySchedules.key === paramKey) {
      return inFlightLoadMySchedules.promise;
    }

    const requestKey = get().requestedMySchedulesKey + 1;
    const shouldRefresh = Boolean(options?.refresh) || get().schedules.length > 0;
    const shouldPersistParams = hasExplicitParams && options?.persistParams !== false;
    set((state) => ({
      requestedMySchedulesKey: requestKey,
      ...(shouldPersistParams
        ? {
            myActiveParams: options?.params,
            loadedRange: mergeLoadedRange(state.loadedRange, options?.params),
          }
        : {}),
      mySchedulesLoading: !shouldRefresh,
      loading: !shouldRefresh || state.schedulesLoading,
      refreshingRequests: state.refreshingRequests + (shouldRefresh ? 1 : 0),
      refreshing: shouldRefresh ? true : state.refreshing,
      error: null,
    }));
    let requestPromise: Promise<void> | null = null;
    requestPromise = (async () => {
      try {
        const schedules = await scheduleService.getMySchedules(effectiveParams);
        set((state) => {
          const refreshingRequests = Math.max(0, state.refreshingRequests - (shouldRefresh ? 1 : 0));
          if (state.requestedMySchedulesKey !== requestKey) {
            return { refreshingRequests, refreshing: refreshingRequests > 0 };
          }
          return {
            schedules,
            mySchedulesLoading: false,
            loading: state.schedulesLoading,
            refreshingRequests,
            refreshing: refreshingRequests > 0,
            error: null,
            lastFetchedAt: Date.now(),
          };
        });
      } catch (error) {
        set((state) => {
          const refreshingRequests = Math.max(0, state.refreshingRequests - (shouldRefresh ? 1 : 0));
          if (state.requestedMySchedulesKey !== requestKey) {
            return { refreshingRequests, refreshing: refreshingRequests > 0 };
          }
          return {
            mySchedulesLoading: false,
            loading: state.schedulesLoading,
            refreshingRequests,
            refreshing: refreshingRequests > 0,
            error: message(error, "Não foi possível carregar escalas."),
          };
        });
      } finally {
        if (inFlightLoadMySchedules?.promise === requestPromise) {
          inFlightLoadMySchedules = null;
        }
      }
    })();

    inFlightLoadMySchedules = { key: paramKey, promise: requestPromise };
    return requestPromise;
  },

  createSchedule: async (payload) => {
    set({ saving: true, error: null });
    try {
      const schedule = await scheduleService.createSchedule(payload);
      set({
        saving: false,
        allSchedules: sortSchedules([...get().allSchedules, schedule]),
      });
      await invalidateRelatedData({ reason: "schedule", ministryId: payload.ministryId });
      void get().loadSchedules({ refresh: true });
      void get().loadMySchedules({ refresh: true });
      return schedule;
    } catch (error) {
      const reason = message(error, "Não foi possível criar escala.");
      set({ saving: false, error: reason });
      throw error;
    }
  },

  updateSchedule: async (id, payload) => {
    set({ saving: true, error: null });
    try {
      const schedule = await scheduleService.updateSchedule(id, payload);
      set({
        saving: false,
        allSchedules: sortSchedules(get().allSchedules.map((item) => item.id === id ? schedule : item)),
      });
      await invalidateRelatedData({ reason: "schedule", ministryId: payload.ministryId });
      void get().loadSchedules({ refresh: true });
      void get().loadMySchedules({ refresh: true });
      return schedule;
    } catch (error) {
      const reason = message(error, "Não foi possível atualizar escala.");
      set({ saving: false, error: reason });
      throw error;
    }
  },

  deleteSchedule: async (id) => {
    const previousSchedules = get().allSchedules;
    const previousAssignments = get().schedules;
    set({ saving: true, error: null });
    try {
      await scheduleService.deleteSchedule(id);
      set({
        saving: false,
        allSchedules: previousSchedules.filter((schedule) => schedule.id !== id),
        schedules: previousAssignments.filter((assignment) => assignment.scheduleId !== id),
      });
      await invalidateRelatedData({ reason: "schedule" });
    } catch (error) {
      const reason = message(error, "Não foi possível excluir escala.");
      set({ saving: false, allSchedules: previousSchedules, schedules: previousAssignments, error: reason });
      throw error;
    }
  },

  updateScheduleStatus: async (scheduleId, assignmentId, status, options) => {
    const previousAssignments = get().schedules;
    const previousSchedules = get().allSchedules;
    const optimisticAssignments = previousAssignments.map((item) =>
      item.id === assignmentId ? { ...item, status } : item
    );

    set({
      error: null,
      schedules: optimisticAssignments,
      allSchedules: previousSchedules.map((schedule) => schedule.id === scheduleId
        ? {
          ...schedule,
          assignments: schedule.assignments?.map((item) => item.id === assignmentId ? { ...item, status } : item),
        }
        : schedule),
    });

    try {
      const updated = await scheduleService.updateAssignmentStatus(scheduleId, assignmentId, status, options);
      set({
        schedules: get().schedules.map((item) =>
          item.id === assignmentId ? { ...item, ...updated, schedule: updated.schedule ?? item.schedule } : item
        ),
        allSchedules: applyAssignmentToSchedules(get().allSchedules, updated),
      });
      await invalidateRelatedData({ reason: "schedule", ministryId: updated.schedule?.ministryId });
      void get().loadMySchedules({ refresh: true });
      void get().loadSchedules({ refresh: true });
    } catch (error) {
      const reason = message(error, "Não foi possível atualizar escala.");
      set({ schedules: previousAssignments, allSchedules: previousSchedules, error: reason });
      throw error;
    }
  },

  resolveSubstitution: async (scheduleId, assignmentId, note) => {
    const previousAssignments = get().schedules;
    const previousSchedules = get().allSchedules;
    set({ error: null });
    try {
      const updated = await scheduleService.resolveSubstitution(scheduleId, assignmentId, note);
      set({
        schedules: get().schedules.map((item) =>
          item.id === assignmentId ? { ...item, ...updated, schedule: updated.schedule ?? item.schedule } : item
        ),
        allSchedules: applyAssignmentToSchedules(get().allSchedules, updated),
      });
    } catch (error) {
      const reason = message(error, "Não foi possível resolver a substituição.");
      set({ schedules: previousAssignments, allSchedules: previousSchedules, error: reason });
      throw error;
    }
  },

  reset: () => {
    inFlightLoadSchedules = null;
    inFlightLoadMySchedules = null;
    set((state) => ({
      allSchedules: [],
      schedules: [],
      activeParams: undefined,
      myActiveParams: undefined,
      loadedRange: null,
      loading: false,
      schedulesLoading: false,
      mySchedulesLoading: false,
      refreshing: false,
      refreshingRequests: 0,
      saving: false,
      error: null,
      lastFetchedAt: null,
      requestedSchedulesKey: state.requestedSchedulesKey + 1,
      requestedMySchedulesKey: state.requestedMySchedulesKey + 1,
    }));
  },
}));
