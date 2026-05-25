import {
  countPendingSchedules,
  formatAssignmentStatus,
  formatScheduleDate,
  getNextSchedule,
} from "./scheduleFormat";
import { ScheduleAssignment } from "../types";

function assignment(id: string, date: string, status: ScheduleAssignment["status"]): ScheduleAssignment {
  return {
    id,
    scheduleId: `schedule-${id}`,
    userId: "user-1",
    role: "Vocal",
    status,
    tenantId: "tenant-1",
    schedule: {
      id: `schedule-${id}`,
      title: `Escala ${id}`,
      date,
      ministryId: "ministry-1",
      tenantId: "tenant-1",
      ministry: { id: "ministry-1", name: "Louvor" },
    },
  };
}

describe("scheduleFormat", () => {
  it("conta escalas pendentes e traduz status", () => {
    const schedules = [
      assignment("1", "2099-01-01T12:00:00.000Z", "PENDING"),
      assignment("2", "2099-01-02T12:00:00.000Z", "ACCEPTED"),
    ];

    expect(countPendingSchedules(schedules)).toBe(1);
    expect(formatAssignmentStatus("PENDING")).toBe("Pendente");
    expect(formatAssignmentStatus("ACCEPTED")).toBe("Aceita");
    expect(formatAssignmentStatus("DECLINED")).toBe("Recusada");
  });

  it("retorna a próxima escala sem expor IDs técnicos", () => {
    const schedules = [
      assignment("later", "2099-02-01T12:00:00.000Z", "PENDING"),
      assignment("next", "2099-01-01T12:00:00.000Z", "PENDING"),
    ];

    const next = getNextSchedule(schedules);

    expect(next?.schedule.title).toBe("Escala next");
    expect(next?.schedule.title).not.toContain("schedule-");
  });

  it("formata empty state de data inválida", () => {
    expect(formatScheduleDate("")).toBe("Data não informada");
    expect(formatScheduleDate("data-invalida")).toBe("Data não informada");
  });
});
