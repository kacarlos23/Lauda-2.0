import {
  countPendingSchedules,
  formatAssignmentStatus,
  formatScheduleDate,
  getNextSchedule,
  sortSchedulesByDate,
} from "./scheduleFormat";
import { AssignmentStatus, MySchedule } from "../types";

function makeSchedule(
  assignmentId: string,
  date: string,
  status: AssignmentStatus = "PENDING"
): MySchedule {
  return {
    assignmentId,
    status,
    role: "Vocal",
    schedule: {
      id: `schedule-${assignmentId}`,
      title: `Escala ${assignmentId}`,
      date,
      ministryId: "ministry-1",
      ministry: { id: "ministry-1", name: "Louvor" },
    },
  };
}

describe("scheduleFormat", () => {
  it("formata status de escala", () => {
    expect(formatAssignmentStatus("PENDING")).toBe("Pendente");
    expect(formatAssignmentStatus("ACCEPTED")).toBe("Aceita");
    expect(formatAssignmentStatus("DECLINED")).toBe("Recusada");
  });

  it("formata data valida em portugues", () => {
    const formatted = formatScheduleDate("2026-05-24T13:30:00.000Z").toLowerCase();

    expect(formatted).toContain("2026");
    expect(formatted).toContain("maio");
  });

  it("retorna texto padrao para data invalida", () => {
    expect(formatScheduleDate("data-invalida")).toBe("Data não informada");
  });

  it("ordena escalas por data crescente", () => {
    const latest = makeSchedule("latest", "2026-05-30T13:00:00.000Z");
    const earliest = makeSchedule("earliest", "2026-05-20T13:00:00.000Z");
    const middle = makeSchedule("middle", "2026-05-24T13:00:00.000Z");

    expect(sortSchedulesByDate([latest, earliest, middle]).map((item) => item.assignmentId)).toEqual([
      "earliest",
      "middle",
      "latest",
    ]);
  });

  it("conta apenas escalas pendentes", () => {
    const schedules = [
      makeSchedule("pending-1", "2026-05-20T13:00:00.000Z", "PENDING"),
      makeSchedule("accepted", "2026-05-21T13:00:00.000Z", "ACCEPTED"),
      makeSchedule("declined", "2026-05-22T13:00:00.000Z", "DECLINED"),
      makeSchedule("pending-2", "2026-05-23T13:00:00.000Z", "PENDING"),
    ];

    expect(countPendingSchedules(schedules)).toBe(2);
  });

  it("retorna a escala mais proxima", () => {
    const next = makeSchedule("next", "2026-05-20T13:00:00.000Z");
    const later = makeSchedule("later", "2026-05-24T13:00:00.000Z");

    expect(getNextSchedule([later, next])).toEqual(next);
  });

  it("retorna null quando a lista esta vazia", () => {
    expect(getNextSchedule([])).toBeNull();
  });
});
