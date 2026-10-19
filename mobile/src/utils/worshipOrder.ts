import { Schedule, ScheduleSong, ScheduleSongDetails, WorshipPeriod } from "../types";

export const worshipMoments = ["Comunhão", "Louvor", "Ofertório", "Pós-lúdio", "Prelúdio", "Outro"] as const;
export const worshipDateKey = (date: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(date));
export function scheduleWorshipPeriod(schedule: Schedule): WorshipPeriod {
  const date = worshipDateKey(schedule.date);
  if (schedule.morningOrders?.some((order) => order.date === date)) return "MORNING";
  if (schedule.eveningOrders?.some((order) => order.date === date)) return "EVENING";
  return null;
}
export function participationDetails(entry: ScheduleSong): ScheduleSongDetails {
  return { songId: entry.songId, moment: entry.moment ?? "Louvor", momentDescription: entry.momentDescription ?? null, videoUrlOverride: null };
}
export const defaultParticipation = (songId: string): ScheduleSongDetails => ({ songId, moment: "Louvor", momentDescription: null, videoUrlOverride: null });
