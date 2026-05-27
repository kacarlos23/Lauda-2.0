export type Role = "GLOBAL_ADMIN" | "TENANT_ADMIN" | "MINISTRY_LEADER" | "MEMBER";
export type MemberStatus = "PENDING" | "ACTIVE" | "INACTIVE";
export type AssignmentStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export interface Tenant {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Instrument {
  id: string;
  name: string;
  colorHex?: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId: string;
  instruments?: Instrument[];
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
  tenantId: string;
  instruments?: Instrument[];
  ministries: Array<{
    ministry: { id: string; name: string };
    isLeader: boolean;
  }>;
}

export interface ScheduleMinistry {
  id: string;
  name: string;
}

export interface Schedule {
  id: string;
  title: string;
  date: string;
  ministryId: string;
  tenantId: string;
  ministry?: ScheduleMinistry | null;
}

export interface ScheduleAssignment {
  id: string;
  scheduleId: string;
  userId: string;
  role: string;
  status: AssignmentStatus;
  tenantId?: string;
  schedule: Schedule;
}

export type MySchedule = Omit<ScheduleAssignment, "id" | "scheduleId" | "userId" | "tenantId" | "schedule"> & {
  id?: string;
  assignmentId?: string;
  scheduleId?: string;
  userId?: string;
  tenantId?: string;
  schedule: Omit<Schedule, "tenantId"> & { tenantId?: string };
};

export interface GlobalTenant {
  id: string;
  name: string;
  createdAt: string;
  _count: {
    users: number;
    ministries: number;
    schedules: number;
    instruments: number;
  };
}

export interface GlobalUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  tenantId: string;
  tenant?: Tenant;
  createdAt: string;
}

export interface GlobalMinistry {
  id: string;
  name: string;
  description?: string | null;
  tenantId: string;
  tenant: Tenant;
  createdAt: string;
  _count?: {
    members: number;
    schedules: number;
  };
}

export interface ChurchSummary {
  tenant: Tenant;
  _count: {
    users: number;
    ministries: number;
    schedules: number;
    instruments: number;
  };
}

export interface ChurchOverview {
  tenant: Tenant;
  members: Member[];
  ministries: Ministry[];
  instruments: Instrument[];
  schedules: Schedule[];
}
