import {
  canAssignScheduleMembers,
  canCreateSchedule,
  canDeleteSchedule,
  canEditSchedule,
  canViewScheduleAdminList,
} from "./schedulePermissions";

describe("schedulePermissions", () => {
  it("permite administrador da igreja criar e modificar escalas no mobile", () => {
    expect(canCreateSchedule("TENANT_ADMIN")).toBe(true);
    expect(canViewScheduleAdminList("TENANT_ADMIN")).toBe(true);
    expect(canEditSchedule("TENANT_ADMIN")).toBe(true);
    expect(canDeleteSchedule("TENANT_ADMIN")).toBe(true);
    expect(canAssignScheduleMembers("TENANT_ADMIN")).toBe(true);
  });

  it("permite líder criar escala sem liberar edição geral", () => {
    expect(canCreateSchedule("MINISTRY_LEADER")).toBe(true);
    expect(canViewScheduleAdminList("MINISTRY_LEADER")).toBe(false);
    expect(canEditSchedule("MINISTRY_LEADER")).toBe(false);
  });

  it("respeita grants explícitos de membros", () => {
    expect(canCreateSchedule({ role: "MEMBER", permissions: ["schedule:create"] })).toBe(true);
    expect(canEditSchedule({ role: "MEMBER", permissions: ["schedule:edit"] })).toBe(true);
    expect(canDeleteSchedule({ role: "MEMBER", permissions: ["schedule:delete"] })).toBe(true);
    expect(canCreateSchedule("MEMBER")).toBe(false);
  });
});
