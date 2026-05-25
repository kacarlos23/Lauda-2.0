import { AxiosError } from "axios";
import { api } from "./api";
import { AssignmentStatus, ScheduleAssignment } from "../types";

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

function handleApiError(error: unknown): never {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { error?: string; message?: string } | undefined;
    throw new Error(data?.error ?? data?.message ?? "Erro ao processar escala.");
  }

  if (error instanceof Error) {
    throw error;
  }

  throw new Error("Erro de rede ao processar escala.");
}

export const scheduleService = {
  async getMySchedules(): Promise<ScheduleAssignment[]> {
    try {
      const response = await api.get<ApiResponse<ScheduleAssignment[]>>("/schedules/me");
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
