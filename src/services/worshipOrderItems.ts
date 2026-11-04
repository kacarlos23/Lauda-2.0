import { worshipReadingSchema, WorshipReading } from "../validators/worshipOrder.schema";

export function parseReadings(value: unknown): WorshipReading[] {
  const result = worshipReadingSchema.array().safeParse(value);
  return result.success ? result.data : [];
}

// Old orders have no readings; songs remain authoritative after edits elsewhere.
export function worshipItems<T>(songs: T[], readings: WorshipReading[] = []): Array<{ kind: "song"; entry: T } | { kind: "reading"; entry: WorshipReading }> {
  const items: Array<{ kind: "song"; entry: T } | { kind: "reading"; entry: WorshipReading }> = songs.map((entry) => ({ kind: "song", entry }));
  for (const entry of [...readings].sort((a, b) => a.position - b.position)) {
    items.splice(Math.min(entry.position, items.length), 0, { kind: "reading", entry });
  }
  return items;
}
