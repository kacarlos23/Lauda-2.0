export const supportResourceNames = [
  "users",
  "ministries",
  "ministry-members",
  "instruments",
  "user-instruments",
  "artists",
  "songs",
  "ministry-songs",
  "schedules",
  "schedule-songs",
  "schedule-assignments",
] as const;

export type SupportResourceName = (typeof supportResourceNames)[number];
export type SupportScope = "read";

export function isSupportResourceName(value: string): value is SupportResourceName {
  return supportResourceNames.includes(value as SupportResourceName);
}
