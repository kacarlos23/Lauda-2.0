import {
  NO_INSTRUMENT,
  NO_MINISTRY,
  emptyMemberFilters,
  filterMembers,
  filterSchedules,
  hasActiveFilters,
  uniqueMemberInstruments,
} from "./listFilters";
import { Member, Schedule } from "../types";

const members: Member[] = [
  {
    id: "member-1",
    name: "Ana Souza",
    email: "ana@example.com",
    role: "MEMBER",
    tenantId: "tenant-1",
    ministries: [{ ministry: { id: "ministry-1", name: "Louvor" }, isLeader: false }],
    instruments: [{ id: "instrument-1", name: "Violão" }],
  },
  {
    id: "member-2",
    name: "Bruno Lima",
    email: "bruno@example.com",
    role: "MINISTRY_LEADER",
    tenantId: "tenant-1",
    ministries: [{ ministry: { id: "ministry-2", name: "Mídia" }, isLeader: true }],
    instruments: [{ id: "instrument-2", name: "Vocal" }],
  },
  {
    id: "member-3",
    name: "Carlos Sem Vínculo",
    email: "carlos@example.com",
    role: "MEMBER",
    tenantId: "tenant-1",
    ministries: [],
    instruments: [],
  },
] as Member[];

const schedules: Schedule[] = [
  {
    id: "schedule-1",
    title: "Culto da manhã",
    date: "2099-01-01T12:00:00.000Z",
    ministryId: "ministry-1",
    tenantId: "tenant-1",
    ministry: { id: "ministry-1", name: "Louvor" },
    assignments: [{ id: "assignment-1", scheduleId: "schedule-1", userId: "member-1", role: "Violão", status: "PENDING", schedule: {} as Schedule }],
  },
  {
    id: "schedule-2",
    title: "Reunião técnica",
    date: "2099-01-01T18:00:00.000Z",
    ministryId: "ministry-2",
    tenantId: "tenant-1",
    ministry: { id: "ministry-2", name: "Mídia" },
    assignments: [{ id: "assignment-2", scheduleId: "schedule-2", userId: "member-2", role: "Mesa", status: "ACCEPTED", schedule: {} as Schedule }],
  },
] as Schedule[];

describe("listFilters", () => {
  it("filtra membros por busca case-insensitive", () => {
    expect(filterMembers(members, { query: "ANA" }).map((member) => member.id)).toEqual(["member-1"]);
    expect(filterMembers(members, { query: "vocal" }).map((member) => member.id)).toEqual(["member-2"]);
  });

  it("aplica filtros combinados de ministério e instrumento", () => {
    expect(filterMembers(members, { ministryId: "ministry-1", instrumentId: "instrument-1" }).map((member) => member.id)).toEqual(["member-1"]);
    expect(filterMembers(members, { ministryId: "ministry-1", instrumentId: "instrument-2" })).toEqual([]);
  });

  it("filtra membros sem ministério e sem instrumento", () => {
    expect(filterMembers(members, { ministryId: NO_MINISTRY }).map((member) => member.id)).toEqual(["member-3"]);
    expect(filterMembers(members, { instrumentId: NO_INSTRUMENT }).map((member) => member.id)).toEqual(["member-3"]);
  });

  it("limpar filtros devolve todos os dados sem mutar a lista original", () => {
    const original = [...members];
    const filtered = filterMembers(members, { query: "sem vínculo" });

    expect(filtered).toHaveLength(1);
    expect(filterMembers(members, emptyMemberFilters)).toHaveLength(3);
    expect(members).toEqual(original);
    expect(hasActiveFilters(emptyMemberFilters)).toBe(false);
  });

  it("permite estado vazio filtrado e opções derivadas sem alterar dados originais", () => {
    expect(filterMembers(members, { query: "inexistente" })).toEqual([]);
    expect(uniqueMemberInstruments(members).map((instrument) => instrument.name)).toEqual(["Violão", "Vocal"]);
    expect(members[0].instruments?.[0].name).toBe("Violão");
  });

  it("filtra escalas por busca, ministério e status combinados", () => {
    const assignmentStatus = new Map([["schedule-1", "PENDING"], ["schedule-2", "ACCEPTED"]]);

    expect(filterSchedules(schedules, { query: "culto", ministryId: "ministry-1", status: "PENDING" }, assignmentStatus).map((item) => item.id)).toEqual(["schedule-1"]);
    expect(filterSchedules(schedules, { query: "culto", status: "ACCEPTED" }, assignmentStatus)).toEqual([]);
  });
  it("filtra escalas por periodo", () => {
    expect(filterSchedules(schedules, { dateFrom: "2099-01-01", dateTo: "2099-01-01" }).map((item) => item.id)).toEqual(["schedule-1", "schedule-2"]);
    expect(filterSchedules(schedules, { dateFrom: "2099-01-02" })).toEqual([]);
  });
});
