import { Role, User } from "../types";
import { can } from "./permissions";

type SchedulePermissionSubject = Pick<User, "role" | "permissions"> | Role | string | null | undefined;

export const canCreateSchedule = (subject?: SchedulePermissionSubject) => can(subject, "schedule:create");
export const canViewScheduleAdminList = (subject?: SchedulePermissionSubject) => can(subject, "schedule:view");
export const canEditSchedule = (subject?: SchedulePermissionSubject) => can(subject, "schedule:edit");
export const canDeleteSchedule = (subject?: SchedulePermissionSubject) => can(subject, "schedule:delete");
export const canAssignScheduleMembers = (subject?: SchedulePermissionSubject) => can(subject, "schedule:assign_members");
export const canViewScheduleReports = (subject?: SchedulePermissionSubject) => can(subject, "schedule:view_reports");
