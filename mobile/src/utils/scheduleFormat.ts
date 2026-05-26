import { ScheduleAssignment } from "../types";

export function formatAssignmentStatus(status?: string): string {
  const labels: Record<string, string> = {
    PENDING: "Pendente",
    ACCEPTED: "Aceita",
    DECLINED: "Recusada",
  };

  return labels[status ?? ""] ?? "Não informado";
}

export function formatScheduleDate(date?: string): string {
  if (!date) return "Data não informada";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Data não informada";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export function countPendingSchedules(schedules: ScheduleAssignment[]): number {
  return schedules.filter((item) => item.status === "PENDING").length;
}

export function getNextSchedule(schedules: ScheduleAssignment[]): ScheduleAssignment | null {
  const now = Date.now();
  const ordered = [...schedules]
    .filter((item) => {
      const time = new Date(item.schedule.date).getTime();
      return !Number.isNaN(time) && time >= now;
    })
    .sort((left, right) => new Date(left.schedule.date).getTime() - new Date(right.schedule.date).getTime());

  return ordered[0] ?? schedules[0] ?? null;
}
