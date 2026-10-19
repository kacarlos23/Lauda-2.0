export type ScheduleAssignmentShape = { userId: string; role: string };

export type ScheduleMutationPermissions = {
  assignments: boolean;
  songs: boolean;
};

export function normalizeScheduleAssignments<T extends ScheduleAssignmentShape>(assignments: T[]): T[] {
  return Array.from(new Map(assignments.map((assignment) => [assignment.userId, assignment])).values());
}

export function normalizeScheduleSongIds(songIds: string[]): string[] {
  return Array.from(new Set(songIds));
}

export function scheduleAssignmentsChanged(
  existing: ScheduleAssignmentShape[],
  requested: ScheduleAssignmentShape[],
  ministryChanged = false,
): boolean {
  const currentByUser = new Map(existing.map((assignment) => [assignment.userId, assignment.role]));
  const next = normalizeScheduleAssignments(requested);

  if (currentByUser.size !== next.length) return true;
  if (next.some((assignment) => currentByUser.get(assignment.userId) !== assignment.role)) return true;

  // Moving a populated schedule changes the ministry context of every assignment.
  return ministryChanged && next.length > 0;
}

export function scheduleSongsChanged(existingSongIds: string[], requestedSongIds: string[]): boolean {
  const current = normalizeScheduleSongIds(existingSongIds);
  const next = normalizeScheduleSongIds(requestedSongIds);
  return current.length !== next.length || current.some((songId, index) => songId !== next[index]);
}
