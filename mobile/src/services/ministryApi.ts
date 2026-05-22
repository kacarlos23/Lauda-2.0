import { api } from "./api";
import { MemberStatus, Ministry, MinistryMember, PaginatedMinistryMembers } from "../types";
import { AxiosError } from "axios";

/**
 * Extracts and throws a user-friendly error from the Axios response, if available.
 */
function handleApiError(error: unknown): never {
  if (error instanceof AxiosError || (typeof error === "object" && error !== null && "response" in error)) {
    const response = (error as AxiosError<{ error?: string; message?: string }>).response;
    const message = response?.data?.error || response?.data?.message || "Erro desconhecido";
    throw new Error(message);
  }
  if (error instanceof Error) {
    throw error;
  }
  throw new Error("Erro desconhecido de rede");
}

export const ministryApi = {
  async getMinistries(): Promise<Ministry[]> {
    try {
      const response = await api.get<{ success: boolean; data: Ministry[] }>("/ministries");
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async getMinistry(id: string): Promise<{ ministry: Ministry; members: MinistryMember[] }> {
    try {
      // Retorna tanto o ministério (suas infos) quanto o relacionamento dos membros. O backend provavelmente engloba os membros no retorno de getById.
      // Retornaremos any de momento para que a view lide com as formatações, mas podemos tipar caso o backend retorne { ...ministry, members: [...] }
      const response = await api.get<{ success: boolean; data: any }>(`/ministries/${id}`);
      const data = response.data.data;
      
      // Mapeando a possível estrutura do prisma
      return {
        ministry: {
          id: data.id,
          name: data.name,
          description: data.description,
          tenantId: data.tenantId,
          createdAt: data.createdAt,
          _count: data._count
        },
        members: data.members || []
      };
    } catch (error) {
      handleApiError(error);
    }
  },

  async createMinistry(data: { name: string; description?: string }): Promise<Ministry> {
    try {
      const response = await api.post<{ success: boolean; data: Ministry }>("/ministries", data);
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async updateMinistry(id: string, data: { name?: string; description?: string }): Promise<Ministry> {
    try {
      const response = await api.put<{ success: boolean; data: Ministry }>(`/ministries/${id}`, data);
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async deleteMinistry(id: string): Promise<void> {
    try {
      await api.delete(`/ministries/${id}`);
    } catch (error) {
      handleApiError(error);
    }
  },

  async addMember(ministryId: string, userId: string, isLeader: boolean = false): Promise<MinistryMember> {
    try {
      const response = await api.post<{ success: boolean; data: MinistryMember }>(`/ministries/${ministryId}/members`, { userId, isLeader });
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async removeMember(ministryId: string, userId: string): Promise<void> {
    try {
      await api.delete(`/ministries/${ministryId}/members/${userId}`);
    } catch (error) {
      handleApiError(error);
    }
  },

  async toggleMinistryMember(
    ministryId: string,
    memberId: string
  ): Promise<{ status: "linked" | "unlinked"; member_id: string; ministry_id: string }> {
    try {
      const response = await api.post<{
        success: boolean;
        data: { status: "linked" | "unlinked"; member_id: string; ministry_id: string };
      }>(`/ministries/${ministryId}/toggle-member`, { member_id: memberId });
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async assignMember(data: {
    ministryId: string;
    userId: string;
    role?: string;
    skills?: string[];
    status?: MemberStatus;
    notes?: string;
    isLeader?: boolean;
  }): Promise<MinistryMember> {
    try {
      const response = await api.post<{ success: boolean; data: MinistryMember }>("/ministries/assign", data);
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async updateAssignment(data: {
    assignmentId: string;
    role?: string | null;
    skills?: string[];
    status?: MemberStatus;
    notes?: string | null;
    isLeader?: boolean;
  }): Promise<MinistryMember> {
    try {
      const response = await api.patch<{ success: boolean; data: MinistryMember }>("/ministries/assignment", data);
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async listMembers(
    ministryId: string,
    params?: { status?: MemberStatus; search?: string; page?: number; limit?: number }
  ): Promise<PaginatedMinistryMembers> {
    try {
      const response = await api.get<{ success: boolean; data: PaginatedMinistryMembers }>(
        `/ministries/${ministryId}/members`,
        { params }
      );
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async getMyAssignments(): Promise<MinistryMember[]> {
    try {
      const response = await api.get<{ success: boolean; data: MinistryMember[] }>("/members/me/ministries");
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  }
};
