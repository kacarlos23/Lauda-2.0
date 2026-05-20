import { AxiosError } from "axios";
import { AssignmentStatus, MySchedule } from "../types";
import { api } from "./api";

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

const validAssignmentStatuses = new Set<AssignmentStatus>(["PENDING", "ACCEPTED", "DECLINED"]);

function assertAssignmentStatus(status: AssignmentStatus): void {
  if (!validAssignmentStatuses.has(status)) {
    throw new Error("Status de escala inválido.");
  }
}

function extractApiError(error: unknown): never {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { error?: string; message?: string } | undefined;
    throw new Error(data?.error ?? data?.message ?? "Não foi possível carregar as escalas.");
  }

  if (error instanceof Error) {
    throw error;
  }

  throw new Error("Não foi possível conectar ao servidor.");
}

export async function getMySchedules(): Promise<MySchedule[]> {
  try {
    const response = await api.get<ApiResponse<MySchedule[]>>("/schedules/me");
    return response.data.data;
  } catch (error) {
    extractApiError(error);
  }
}

export async function updateAssignmentStatus(
  scheduleId: string,
  assignmentId: string,
  status: AssignmentStatus
): Promise<MySchedule> {
  assertAssignmentStatus(status);

  try {
    const response = await api.patch<ApiResponse<MySchedule>>(
      `/schedules/${scheduleId}/assignments/${assignmentId}/status`,
      { status }
    );
    return response.data.data;
  } catch (error) {
    extractApiError(error);
  }
}

