import { AxiosError } from "axios";
import { api } from "./api";
import { AssignmentStatus, Schedule, ScheduleAssignment } from "../types";

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

function handleApiError(error: unknown): never {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { error?: string; message?: string } | undefined;
    throw new Error(data?.error ?? data?.message ?? "Não foi possível carregar as escalas.");
  }

  if (error instanceof Error) {
    throw error;
  }

  throw new Error("Não foi possível carregar as escalas.");
}

function assertAssignmentStatus(status: AssignmentStatus): void {
  if (!["PENDING", "ACCEPTED", "DECLINED"].includes(status)) {
    throw new Error("Status de escala inválido.");
  }
}

export const scheduleService = {
  async listSchedules(): Promise<Schedule[]> {
    try {
      const response = await api.get<ApiResponse<Schedule[]>>("/schedules");
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async getMySchedules(): Promise<ScheduleAssignment[]> {
    try {
      const response = await api.get<ApiResponse<ScheduleAssignment[]>>("/schedules/me");
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async createSchedule(payload: {
    title: string;
    date: string;
    ministryId: string;
    songIds: string[];
    assignments: Array<{ userId: string; role: string }>;
  }): Promise<Schedule> {
    try {
      const response = await api.post<ApiResponse<Schedule>>("/schedules", payload);
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async updateSchedule(id: string, payload: {
    title: string;
    date: string;
    ministryId: string;
    songIds: string[];
    assignments: Array<{ userId: string; role: string; status?: AssignmentStatus }>;
  }): Promise<Schedule> {
    try {
      const response = await api.patch<ApiResponse<Schedule>>(`/schedules/${id}`, payload);
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async updateAssignmentStatus(
    scheduleId: string,
    assignmentId: string,
    status: AssignmentStatus
  ): Promise<ScheduleAssignment> {
    assertAssignmentStatus(status);

    try {
      const response = await api.patch<ApiResponse<ScheduleAssignment>>(
        `/schedules/${scheduleId}/assignments/${assignmentId}/status`,
        { status }
      );
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },
};

export const getMySchedules = scheduleService.getMySchedules;
export const updateAssignmentStatus = scheduleService.updateAssignmentStatus;
