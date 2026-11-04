import { Schedule, ScheduleSong, WorshipReading } from "../types";

export type WorshipItem = { kind: "song"; entry: ScheduleSong } | { kind: "reading"; entry: WorshipReading };
export function worshipItems(schedule: Pick<Schedule, "songs" | "readings">): WorshipItem[] {
  const items: WorshipItem[] = [...(schedule.songs ?? [])].sort((a, b) => a.order - b.order).map((entry) => ({ kind: "song", entry }));
  for (const entry of [...(schedule.readings ?? [])].sort((a, b) => a.position - b.position)) {
    items.splice(Math.min(entry.position, items.length), 0, { kind: "reading", entry });
  }
  return items;
}
export function withWorshipItems(schedule: Schedule, items: WorshipItem[]): Schedule {
  const songs: ScheduleSong[] = [], readings: WorshipReading[] = [];
  items.forEach((item, position) => {
    if (item.kind === "song") songs.push({ ...item.entry, order: songs.length });
    else readings.push({ ...item.entry, position });
  });
  return { ...schedule, songs, readings };
}
export function worshipOrderText(periods: Record<"morning" | "evening", Schedule | null>): string {
  const lines: string[] = [];
  for (const period of ["morning", "evening"] as const) {
    const schedule = periods[period];
    if (!schedule) continue;
    if (lines.length) lines.push("");
    lines.push(`=== ${schedule.title} ===`);
    for (const item of worshipItems(schedule)) {
      if (item.kind === "reading") {
        lines.push("- Leitura bíblica:", ...item.entry.text.split(/\r?\n/).map((line) => line.trim()).map((line) => line ? `*${line}*` : ""));
      }
      else {
        const { entry } = item;
        const moment = entry.moment === "Outro" && entry.momentDescription ? entry.momentDescription : entry.moment ?? "Louvor";
        const artist = entry.song.artist?.name?.trim();
        lines.push(`- ${entry.song.title}${artist ? ` (${artist})` : ""} · ${moment}`);
      }
    }
  }
  return lines.join("\n");
}
