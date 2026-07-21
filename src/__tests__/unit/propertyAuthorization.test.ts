import { createArtistSchema, updateArtistSchema } from "../../validators/artist.schema";
import { publicMemberRegisterSchema } from "../../validators/auth.schema";
import { updateChurchSchema } from "../../validators/church.schema";
import { createInstrumentSchema, updateInstrumentSchema } from "../../validators/instrument.schema";
import { createMemberSchema, updateMemberSchema, updateMyProfileSchema } from "../../validators/member.schema";
import { createMinistrySchema, updateMinistrySchema } from "../../validators/ministry.schema";
import { createScheduleSchema, listSchedulesSchema, updateScheduleSchema } from "../../validators/schedule.schema";
import { createSongSchema, songListSchema, updateSongSchema } from "../../validators/song.schema";

const protectedFields = {
  tenantId: "00000000-0000-4000-8000-000000000099",
  role: "GLOBAL_ADMIN",
  permissions: ["permissions:manage"],
  ownerId: "00000000-0000-4000-8000-000000000098",
  createdBy: "attacker",
  createdById: "00000000-0000-4000-8000-000000000098",
  isActive: false,
  deletedAt: "2020-01-01T00:00:00.000Z",
  TenantId: "alternate-casing",
  ROLE: "GLOBAL_ADMIN",
};

function expectProtectedFieldsIgnored(result: Record<string, unknown>) {
  for (const key of Object.keys(protectedFields)) expect(result).not.toHaveProperty(key);
}

describe("property-level authorization matrix", () => {
  it.each([
    ["artist create", createArtistSchema, { name: "Artista" }],
    ["artist patch", updateArtistSchema, { name: "Artista novo" }],
    ["instrument create", createInstrumentSchema, { name: "Violão" }],
    ["instrument patch", updateInstrumentSchema, { colorHex: "#112233" }],
    ["member patch", updateMemberSchema, { name: "Membro novo" }],
    ["self profile", updateMyProfileSchema, { name: "Perfil novo" }],
    ["ministry create", createMinistrySchema, { name: "Louvor" }],
    ["ministry put", updateMinistrySchema, { description: "Descrição" }],
    ["church patch", updateChurchSchema, { name: "Igreja" }],
    ["public registration", publicMemberRegisterSchema, { inviteCode: "ABCD-1234", name: "Membro", email: "public@example.com", password: "secret123" }],
  ] as const)("ignores protected properties for %s", (_name, schema, valid) => {
    const parsed = schema.parse({ ...valid, ...protectedFields }) as Record<string, unknown>;
    expectProtectedFieldsIgnored(parsed);
  });

  it("rejects escalation through the intentionally exposed member role field", () => {
    expect(() => createMemberSchema.parse({
      name: "Membro",
      email: "member@example.com",
      password: "secret123",
      ...protectedFields,
    })).toThrow();
    const allowedRole = createMemberSchema.parse({
      name: "Líder",
      email: "leader@example.com",
      password: "secret123",
      role: "MINISTRY_LEADER",
      tenantId: protectedFields.tenantId,
      isActive: false,
    });
    expect(allowedRole).toEqual(expect.objectContaining({ role: "MINISTRY_LEADER" }));
    expect(allowedRole).not.toHaveProperty("tenantId");
    expect(allowedRole).not.toHaveProperty("isActive");
  });

  it("ignores protected fields in song create/PATCH and a complete GET object replay", () => {
    const valid = {
      title: "Canção", artistId: "00000000-0000-4000-8000-000000000001",
      originalKey: "G", content: "[G]Conteúdo",
    };
    expectProtectedFieldsIgnored(createSongSchema.parse({ ...valid, ...protectedFields }) as Record<string, unknown>);
    const replay = updateSongSchema.parse({
      ...valid,
      id: "00000000-0000-4000-8000-000000000002",
      artist: { id: valid.artistId, tenantId: protectedFields.tenantId },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...protectedFields,
    }) as Record<string, unknown>;
    expectProtectedFieldsIgnored(replay);
    expect(replay).not.toHaveProperty("id");
    expect(replay).not.toHaveProperty("artist");
  });

  it("ignores protected properties at schedule root and inside relational arrays", () => {
    const payload = {
      title: "Culto domingo",
      date: "2026-07-19T12:00:00.000Z",
      ministryId: "00000000-0000-4000-8000-000000000001",
      assignments: [{
        userId: "00000000-0000-4000-8000-000000000002",
        role: "Vocal",
        tenantId: protectedFields.tenantId,
        isActive: false,
        deletedAt: protectedFields.deletedAt,
      }],
      songIds: [],
      ...protectedFields,
    };
    for (const schema of [createScheduleSchema, updateScheduleSchema]) {
      const parsed = schema.parse(payload) as unknown as Record<string, any>;
      expectProtectedFieldsIgnored(parsed);
      expect(parsed.assignments[0]).toEqual({
        userId: "00000000-0000-4000-8000-000000000002",
        role: "Vocal",
        status: "PENDING",
      });
    }
  });

  it("rejects duplicate query values and ignores forged tenant filters", () => {
    expect(() => songListSchema.parse({ search: ["a", "b"] })).toThrow();
    expect(() => listSchedulesSchema.parse({ ministryId: ["a", "b"] })).toThrow();
    expect(songListSchema.parse({ tenantId: protectedFields.tenantId })).not.toHaveProperty("tenantId");
  });
});
