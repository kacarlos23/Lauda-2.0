import { AssignmentStatus, Instrument, Member, Ministry, Schedule, Song } from "../types";
import { richTextToPlainText } from "../../../src/contracts/richText";

export const NO_MINISTRY = "__NO_MINISTRY__";
export const NO_INSTRUMENT = "__NO_INSTRUMENT__";

export type MemberListFilters = {
  query?: string;
  ministryId?: string;
  instrumentId?: string;
  role?: string;
};

export type MinistryListFilters = {
  query?: string;
};

export type InstrumentListFilters = {
  query?: string;
};

export type SongListFilters = {
  query?: string;
};

export type ScheduleListFilters = {
  query?: string;
  ministryId?: string;
  status?: AssignmentStatus | string;
  dateFrom?: string;
  dateTo?: string;
};

export const emptyMemberFilters: MemberListFilters = {};
export const emptyMinistryFilters: MinistryListFilters = {};
export const emptyInstrumentFilters: InstrumentListFilters = {};
export const emptySongFilters: SongListFilters = {};
export const emptyScheduleFilters: ScheduleListFilters = {};

function normalize(value?: string | null) {
  return value?.trim().toLocaleLowerCase("pt-BR") ?? "";
}

function includesText(value: string | undefined | null, query: string) {
  return normalize(value).includes(query);
}

export function hasActiveFilters(filters: Record<string, unknown>) {
  return Object.values(filters).some((value) => typeof value === "string" ? value.trim().length > 0 : Boolean(value));
}

export function filterMembers(members: Member[], filters: MemberListFilters) {
  const query = normalize(filters.query);

  return members.filter((member) => {
    if (query) {
      const ministryText = member.ministries?.map((item) => item.ministry.name).join(" ") ?? "";
      const instrumentText = member.instruments?.map((item) => item.name).join(" ") ?? "";
      const haystack = `${member.name} ${member.email ?? ""} ${member.phone ?? ""} ${member.role} ${ministryText} ${instrumentText} ${richTextToPlainText(member.comments)}`;
      if (!includesText(haystack, query)) return false;
    }

    if (filters.ministryId === NO_MINISTRY && member.ministries?.length) return false;
    if (filters.ministryId && filters.ministryId !== NO_MINISTRY && !member.ministries?.some((item) => item.ministry.id === filters.ministryId)) return false;

    if (filters.instrumentId === NO_INSTRUMENT && member.instruments?.length) return false;
    if (filters.instrumentId && filters.instrumentId !== NO_INSTRUMENT && !member.instruments?.some((item) => item.id === filters.instrumentId)) return false;

    if (filters.role && member.role !== filters.role) return false;

    return true;
  });
}

export function filterMinistries(ministries: Ministry[], filters: MinistryListFilters) {
  const query = normalize(filters.query);
  if (!query) return ministries;
  return ministries.filter((ministry) => includesText(`${ministry.name} ${ministry.description ?? ""} ${richTextToPlainText(ministry.comments)}`, query));
}

export function filterInstruments(instruments: Instrument[], filters: InstrumentListFilters) {
  const query = normalize(filters.query);
  if (!query) return instruments;
  return instruments.filter((instrument) => includesText(`${instrument.name} ${instrument.colorHex ?? ""}`, query));
}

export function filterSongs(songs: Song[], filters: SongListFilters) {
  const query = normalize(filters.query);
  if (!query) return songs;
  return songs.filter((song) => includesText(`${song.title} ${song.artist?.name ?? ""} ${song.composer ?? ""} ${song.originalKey} ${richTextToPlainText(song.comments)}`, query));
}

export function filterSchedules(
  schedules: Schedule[],
  filters: ScheduleListFilters,
  assignmentStatusByScheduleId = new Map<string, string | undefined>()
) {
  const query = normalize(filters.query);

  return schedules.filter((schedule) => {
    if (query) {
      const songs = schedule.songs?.map((item) => item.song.title).join(" ") ?? "";
      const members = schedule.assignments?.map((item) => `${item.user?.name ?? ""} ${item.role}`).join(" ") ?? "";
      const haystack = `${schedule.title} ${schedule.ministry?.name ?? ""} ${songs} ${members} ${richTextToPlainText(schedule.comments)}`;
      if (!includesText(haystack, query)) return false;
    }

    if (filters.ministryId === NO_MINISTRY && schedule.ministryId) return false;
    if (filters.ministryId && filters.ministryId !== NO_MINISTRY && schedule.ministryId !== filters.ministryId) return false;

    if (filters.status) {
      const ownStatus = assignmentStatusByScheduleId.get(schedule.id);
      const hasStatus = ownStatus === filters.status || schedule.assignments?.some((assignment) => assignment.status === filters.status);
      if (!hasStatus) return false;
    }

    const scheduleTime = new Date(schedule.date).getTime();
    if (filters.dateFrom) {
      const fromTime = new Date(`${filters.dateFrom}T00:00:00`).getTime();
      if (!Number.isNaN(fromTime) && scheduleTime < fromTime) return false;
    }
    if (filters.dateTo) {
      const toTime = new Date(`${filters.dateTo}T23:59:59`).getTime();
      if (!Number.isNaN(toTime) && scheduleTime > toTime) return false;
    }

    return true;
  });
}

export function uniqueMemberInstruments(members: Member[]) {
  const map = new Map<string, Instrument>();
  members.forEach((member) => member.instruments?.forEach((instrument) => map.set(instrument.id, instrument)));
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function uniqueMemberMinistries(members: Member[]) {
  const map = new Map<string, { id: string; name: string }>();
  members.forEach((member) => member.ministries?.forEach((item) => map.set(item.ministry.id, item.ministry)));
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function uniqueScheduleMinistries(schedules: Schedule[]) {
  const map = new Map<string, { id: string; name: string }>();
  schedules.forEach((schedule) => {
    if (schedule.ministryId) map.set(schedule.ministryId, { id: schedule.ministryId, name: schedule.ministry?.name ?? "Ministério sem nome" });
  });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
