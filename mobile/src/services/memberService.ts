import { AxiosError } from "axios";
import { api } from "./api";
import { Member, Role } from "../types";

export type CreateMemberPayload = {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: Extract<Role, "MEMBER" | "MINISTRY_LEADER">;
};

export type LinkMemberMinistryPayload = {
  ministryId: string;
  isLeader?: boolean;
};

export type UpdateMemberPermissionsPayload = {
  role: Extract<Role, "MEMBER" | "MINISTRY_LEADER" | "TENANT_ADMIN">;
  ministries: Array<{
    ministryId: string;
    isLeader: boolean;
  }>;
};

export type UpdateMyProfilePayload = {
  name?: string;
  phone?: string | null;
  avatarUrl?: string | null;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export type MemberInvite = {
  id: string;
  code: string;
  active: boolean;
  ministryId?: string | null;
  ministry?: { id: string; name: string } | null;
  expiresAt?: string | null;
  createdAt: string;
  inviteLink: string;
};

function handleApiError(error: unknown): never {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { error?: string; message?: string } | undefined;
    throw new Error(data?.error ?? data?.message ?? "Erro ao processar membro.");
  }

  if (error instanceof Error) {
    throw error;
  }

  throw new Error("Erro de rede ao processar membro.");
}

export const memberService = {
  async createMember(payload: CreateMemberPayload): Promise<Member> {
    try {
      const response = await api.post<ApiResponse<Member>>("/members", payload);
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async listMembers(): Promise<Member[]> {
    try {
      const response = await api.get<ApiResponse<Member[]>>("/members");
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async getCurrentMember(): Promise<Member> {
    try {
      const response = await api.get<ApiResponse<Member>>("/members/me");
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async updateMyProfile(payload: UpdateMyProfilePayload): Promise<Member> {
    try {
      const response = await api.patch<ApiResponse<Member>>("/members/me/profile", payload);
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async addMinistry(memberId: string, payload: LinkMemberMinistryPayload): Promise<void> {
    try {
      await api.post(`/members/${memberId}/ministries`, payload);
    } catch (error) {
      handleApiError(error);
    }
  },

  async updatePermissions(memberId: string, payload: UpdateMemberPermissionsPayload): Promise<Member> {
    try {
      const response = await api.patch<ApiResponse<Member>>(`/members/${memberId}/permissions`, payload);
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async getMemberInvite(ministryId?: string): Promise<MemberInvite> {
    try {
      const response = await api.get<ApiResponse<MemberInvite>>("/auth/member-invite", {
        params: ministryId ? { ministryId } : undefined,
      });
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async regenerateMemberInvite(ministryId?: string): Promise<MemberInvite> {
    try {
      const response = await api.post<ApiResponse<MemberInvite>>("/auth/member-invite/regenerate", {
        ministryId,
      });
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },
};
