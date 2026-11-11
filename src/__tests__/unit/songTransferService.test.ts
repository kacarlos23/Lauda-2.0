import { Role } from "@prisma/client";
import { SongTransferService } from "../../services/songTransferService";
import { prisma } from "../../repositories/prismaClient";
import { songTransferPreviewSchema } from "../../validators/songTransfer.schema";

jest.mock("../../repositories/prismaClient", () => ({ prisma: {
  ministry: { findFirst: jest.fn() },
  ministrySong: { findMany: jest.fn(), upsert: jest.fn() },
  artist: { findUnique: jest.fn() },
  song: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  songTag: { createMany: jest.fn(), findMany: jest.fn() },
  songTagAssignment: { deleteMany: jest.fn(), createMany: jest.fn() },
  $transaction: jest.fn(),
} }));

const service = new SongTransferService({ id: "user-a", tenantId: "tenant-a", role: Role.TENANT_ADMIN });
const ministryId = "7d5748e1-3a21-4a3f-b9a6-812983343a77";
const incoming = { title: "Cristo Venceu", artist: "JMM", originalKey: "A", content: "A D E", tags: [] };
const existing = {
  id: "song-a", title: incoming.title, normalizedTitle: "cristo venceu", originalKey: "A", content: "A D E",
  cifraUrl: null, isActive: true, deletedAt: null,
  artist: { name: "JMM", normalizedName: "jmm" }, ministries: [{ isActive: true, deletedAt: null }],
};
const importInput = (song: object = incoming, fields?: string[]) => songTransferPreviewSchema.parse({
  ministryId, existing: "update", fields,
  document: { format: "lauda.music-catalog", version: 1, songs: [song] },
});
const commit = async (input = importInput()) => {
  const preview = await service.preview(input);
  return service.commit({ ...input, documentHash: preview.documentHash });
};

describe("SongTransferService themes", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(prisma.ministry.findFirst).mockResolvedValue({ id: ministryId } as any);
    jest.mocked(prisma.artist.findUnique).mockResolvedValue({ id: "artist-a", isActive: true, deletedAt: null } as any);
    jest.mocked(prisma.song.findMany).mockResolvedValue([existing] as any);
    jest.mocked(prisma.song.findUnique).mockResolvedValue(existing as any);
    jest.mocked(prisma.song.create).mockResolvedValue({ ...existing, ministries: [] } as any);
    jest.mocked(prisma.song.update).mockResolvedValue(existing as any);
    (prisma.$transaction as jest.Mock).mockImplementation((run) => run(prisma));
    jest.mocked(prisma.ministrySong.findMany).mockResolvedValue([{
      songId: existing.id, song: { ...existing, tags: [], bpm: null, comments: null, letraUrl: null, audioUrl: null, videoUrl: null },
    }] as any);
  });

  it.each([undefined, ["tags"] as const])("exports empty tags when selected, including legacy defaults (%s)", async (fields) => {
    const exported = await service.export({ ministryId, fields: fields ? [...fields] : undefined });
    expect(JSON.parse(JSON.stringify(exported)).songs[0].tags).toEqual([]);
  });

  it("omits tags only when the field is not selected", async () => {
    expect((await service.export({ ministryId, fields: ["content"] })).songs[0]).not.toHaveProperty("tags");
  });

  it("creates a song with tags: [] without creating themes or assignments", async () => {
    jest.mocked(prisma.song.findMany).mockResolvedValue([]);
    jest.mocked(prisma.song.findUnique).mockResolvedValue(null);
    expect((await commit()).created).toBe(1);
    expect(prisma.song.create).toHaveBeenCalledTimes(1);
    expect(prisma.songTag.createMany).not.toHaveBeenCalled();
    expect(prisma.songTagAssignment.createMany).not.toHaveBeenCalled();
    expect(prisma.songTagAssignment.deleteMany).not.toHaveBeenCalled();
  });

  it("clears themes on UPDATE with selected tags: []", async () => {
    expect((await commit(importInput(incoming, ["tags"]))).updated).toBe(1);
    expect(prisma.songTagAssignment.deleteMany).toHaveBeenCalledWith({ where: { songId: existing.id, tenantId: "tenant-a" } });
    expect(prisma.songTag.createMany).not.toHaveBeenCalled();
    expect(prisma.songTagAssignment.createMany).not.toHaveBeenCalled();
  });

  it("preserves themes when tags are omitted or unselected", async () => {
    const { tags, ...withoutTags } = incoming;
    await commit(importInput(withoutTags));
    await commit(importInput(incoming, ["content"]));
    expect(prisma.songTagAssignment.deleteMany).not.toHaveBeenCalled();
  });

  it("reports restored as a subset of updated in update mode", async () => {
    const inactive = { ...existing, isActive: false, deletedAt: new Date("2026-01-01") };
    jest.mocked(prisma.song.findMany).mockResolvedValue([inactive] as any);
    jest.mocked(prisma.song.findUnique).mockResolvedValue(inactive as any);
    expect(await commit()).toMatchObject({ total: 1, updated: 1, restored: 1 });
    expect(prisma.song.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isActive: true, deletedAt: null }) }));
  });
});
