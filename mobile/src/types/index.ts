export type Role = "GLOBAL_ADMIN" | "TENANT_ADMIN" | "MINISTRY_LEADER" | "MEMBER";

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
  isLeader: boolean;
  createdAt: string;
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
