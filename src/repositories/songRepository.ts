import { Prisma } from "@prisma/client";
import { prisma } from "./prismaClient";
import { SongListInput } from "../validators/song.schema";

export const songSelect = {
  id: true,
  title: true,
  composer: true,
  originalKey: true,
  content: true,
  bpm: true,
  cifraUrl: true,
  letraUrl: true,
  audioUrl: true,
  videoUrl: true,
  artistId: true,
  artist: { select: { id: true, name: true, imageUrl: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SongSelect;

export class SongRepository {
  constructor(private readonly tenantId: string) {}

  async list(input: SongListInput, normalizedSearch: string) {
    const where: Prisma.SongWhereInput = {
      tenantId: this.tenantId,
      ...(input.artistId ? { artistId: input.artistId } : {}),
      ...(normalizedSearch ? {
        OR: [
          { normalizedTitle: { contains: normalizedSearch } },
          { artist: { normalizedName: { contains: normalizedSearch } } },
        ],
      } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.song.findMany({
        where,
        select: songSelect,
        orderBy: [{ title: "asc" }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      prisma.song.count({ where }),
    ]);
    return { items, total };
  }

  findById(id: string) {
    return prisma.song.findFirst({ where: { id, tenantId: this.tenantId }, select: songSelect });
  }

  findByIds(ids: string[]) {
    return prisma.song.findMany({ where: { id: { in: ids }, tenantId: this.tenantId }, select: songSelect });
  }

  create(data: {
    title: string;
    normalizedTitle: string;
    artistId: string;
    composer: string | null;
    originalKey: string;
    content: string;
    bpm: number | null;
    cifraUrl?: string | null;
    letraUrl?: string | null;
    audioUrl?: string | null;
    videoUrl?: string | null;
    userId: string;
  }) {
    const { userId, ...songData } = data;
    return prisma.song.create({
      data: {
        ...songData,
        tenantId: this.tenantId,
        createdById: userId,
        updatedById: userId,
      },
      select: songSelect,
    });
  }

  async update(id: string, data: Prisma.SongUncheckedUpdateManyInput) {
    const result = await prisma.song.updateMany({ where: { id, tenantId: this.tenantId }, data });
    return result.count ? this.findById(id) : null;
  }
}
