import {
  normalizeScheduleAssignments,
  normalizeScheduleSongIds,
  scheduleAssignmentsChanged,
  scheduleSongsChanged,
} from "../../security/scheduleMutationPolicy";

describe("scheduleMutationPolicy", () => {
  it("distingue edição do pai de inclusão, remoção e troca de função", () => {
    const current = [{ userId: "user-1", role: "Vocal" }];

    expect(scheduleAssignmentsChanged(current, [...current])).toBe(false);
    expect(scheduleAssignmentsChanged(current, [])).toBe(true);
    expect(scheduleAssignmentsChanged(current, [{ userId: "user-1", role: "Baixo" }])).toBe(true);
    expect(scheduleAssignmentsChanged(current, [...current, { userId: "user-2", role: "Vocal" }])).toBe(true);
    expect(scheduleAssignmentsChanged(current, [...current], true)).toBe(true);
    expect(scheduleAssignmentsChanged([], [], true)).toBe(false);
  });

  it("considera remoção, inclusão e ordem das músicas", () => {
    expect(scheduleSongsChanged(["song-1", "song-2"], ["song-1", "song-2"])).toBe(false);
    expect(scheduleSongsChanged(["song-1", "song-2"], [])).toBe(true);
    expect(scheduleSongsChanged(["song-1", "song-2"], ["song-2", "song-1"])).toBe(true);
    expect(scheduleSongsChanged(["song-1"], ["song-1", "song-2"])).toBe(true);
  });

  it("normaliza duplicidades como o repositório antes da comparação", () => {
    expect(normalizeScheduleSongIds(["song-1", "song-1", "song-2"])).toEqual(["song-1", "song-2"]);
    expect(normalizeScheduleAssignments([
      { userId: "user-1", role: "Vocal" },
      { userId: "user-1", role: "Baixo" },
    ])).toEqual([{ userId: "user-1", role: "Baixo" }]);
  });
});
