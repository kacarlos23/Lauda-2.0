export type Role = "GLOBAL_ADMIN" | "TENANT_ADMIN" | "MINISTRY_LEADER" | "MEMBER";
export type MemberStatus = "PENDING" | "ACTIVE" | "INACTIVE";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId: string;
}

export interface Ministry {
  id: string;
  name: string;
  description?: string | null;
  tenantId: string;
  createdAt: string;
  _count?: { members: number };
}

export interface MinistryMember {
  id: string;
  userId: string;
  user: Pick<User, 'id' | 'name' | 'email'>;
  ministryId: string;
  ministry?: Pick<Ministry, "id" | "name" | "tenantId">;
  roleId?: string | null;
  role?: string | null;
  skills: string[];
  status: MemberStatus;
  joinedAt: string;
  notes?: string | null;
  isLeader: boolean;
  createdAt: string;
}

export interface PaginatedMinistryMembers {
  items: MinistryMember[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface Member {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  ministries: Array<{
    ministry: { id: string; name: string };
    isLeader: boolean;
  }>;
}
