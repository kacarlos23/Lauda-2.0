import { AssignmentStatus, MySchedule } from "../types";

export function formatAssignmentStatus(status: AssignmentStatus): string {
  const labels: Record<AssignmentStatus, string> = {
    PENDING: "Pendente",
    ACCEPTED: "Aceita",
    DECLINED: "Recusada",
  };

  return labels[status];
}

export function formatScheduleDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "Data não informada";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export function sortSchedulesByDate(schedules: MySchedule[]): MySchedule[] {
  return [...schedules].sort((a, b) => {
    const aTime = new Date(a.schedule.date).getTime();
    const bTime = new Date(b.schedule.date).getTime();
    return aTime - bTime;
  });
}

export function countPendingSchedules(schedules: MySchedule[]): number {
  return schedules.filter((item) => item.status === "PENDING").length;
}

export function getNextSchedule(schedules: MySchedule[]): MySchedule | null {
  return sortSchedulesByDate(schedules)[0] ?? null;
}

