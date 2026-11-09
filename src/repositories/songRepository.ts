import { Prisma } from "@prisma/client";
import { PreparedSongTag, sortSongTagNames } from "../constants/songTags";
import { normalizeCatalogText } from "../utils/catalogNormalization";
import { prisma } from "./prismaClient";
import { replaceSongTags } from "./songTagRepository";
import { SongListInput, SongScopeInput } from "../validators/song.schema";
import { foldThemeSearch, parseSongSearch } from "../utils/songSearch";

export const songSelect = {
  id: true,
  title: true,
  composer: true,
  originalKey: true,
  content: true,
  comments: true,
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

const songWithTagsSelect = {
  ...songSelect,
  tags: { select: { tag: { select: { name: true } } } },
} satisfies Prisma.SongSelect;

function presentSong<T extends { tags: Array<{ tag: { name: string } }> }>(song: T) {
  const { tags, ...rest } = song;
  return { ...rest, tags: sortSongTagNames(tags.map((link) => link.tag.name)) };
}

export class SongRepository {
  constructor(private readonly tenantId: string) {}

  private async scope(input: SongScopeInput, db: Pick<typeof prisma, "songTag">): Promise<Prisma.SongWhereInput> {
    const where: Prisma.SongWhereInput = {
      tenantId: this.tenantId,
      isActive: true,
      deletedAt: null,
      ...(input.artistId ? { artistId: input.artistId } : {}),
      ...(input.originalKey ? { originalKey: input.originalKey } : {}),
      ...(input.ministryId ? {
        ministries: { some: { ministryId: input.ministryId, isActive: true, deletedAt: null } },
      } : {}),
    };
    const { term, themeOnly, themeTerm } = parseSongSearch(input.search);
    if (!term) return where;

    // Resolve accent-insensitive matches once for the whole catalogue.
    const tags = await db.songTag.findMany({
      where: { tenantId: this.tenantId },
      select: { normalizedName: true },
    });
    const names = tags.map((tag) => tag.normalizedName).filter((name) => foldThemeSearch(name).includes(themeTerm));
    const matchesTheme = this.matchesThemes(names);
    return {
      ...where,
      OR: themeOnly ? [matchesTheme] : [
        { normalizedTitle: { contains: term } },
        { artist: { normalizedName: { contains: term } } },
        matchesTheme,
      ],
    };
  }

  private matchesThemes(names: string[]): Prisma.SongWhereInput {
    return {
      tags: { some: { tenantId: this.tenantId, tag: { tenantId: this.tenantId, normalizedName: { in: names } } } },
    };
  }

  private withoutThemes(): Prisma.SongWhereInput {
    return { tags: { none: { tenantId: this.tenantId } } };
  }

  async list(input: SongListInput) {
    const scope = await this.scope(input, prisma);
    const themes: Prisma.SongWhereInput[] = [];
    if (input.tags?.length) themes.push(this.matchesThemes(input.tags.map(normalizeCatalogText)));
    if (input.untagged) themes.push(this.withoutThemes());
    const where = themes.length ? { ...scope, AND: { OR: themes } } : scope;
    const [items, total] = await Promise.all([
      prisma.song.findMany({
        where,
        select: songWithTagsSelect,
        orderBy: [{ title: "asc" }, { id: "asc" }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      prisma.song.count({ where }),
    ]);
    return { items: items.map(presentSong), total };
  }

  listTags(input: SongScopeInput) {
    return prisma.$transaction(async (db) => {
      const scope = await this.scope(input, db);
      const [tags, untaggedCount] = await Promise.all([
        db.songTag.findMany({
          where: { tenantId: this.tenantId },
          select: {
            id: true,
            name: true,
            _count: { select: { songs: { where: { tenantId: this.tenantId, song: scope } } } },
          },
          orderBy: { name: "asc" },
        }),
        db.song.count({ where: { ...scope, ...this.withoutThemes() } }),
      ]);
      const items = tags.map(({ _count, ...tag }) => ({ ...tag, count: _count.songs }));
      return { items, untaggedCount };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  findById(id: string) {
    return prisma.song.findFirst({
      where: { id, tenantId: this.tenantId, isActive: true, deletedAt: null },
      select: songWithTagsSelect,
    }).then((song) => song ? presentSong(song) : null);
  }

  findByIds(ids: string[]) {
    return prisma.song.findMany({
      where: { id: { in: ids }, tenantId: this.tenantId, isActive: true, deletedAt: null },
      select: songWithTagsSelect,
    }).then((songs) => songs.map(presentSong));
  }

  findInactiveIds(ids: string[]) {
    return prisma.song.findMany({
      where: {
        id: { in: ids },
        tenantId: this.tenantId,
        OR: [{ isActive: false }, { deletedAt: { not: null } }],
      },
      select: { id: true },
    });
  }

  create(data: {
    title: string;
    normalizedTitle: string;
    artistId: string;
    composer: string | null;
    originalKey: string;
    content: string;
    comments?: string | null;
    bpm: number | null;
    cifraUrl?: string | null;
    letraUrl?: string | null;
    audioUrl?: string | null;
    videoUrl?: string | null;
    userId: string;
  }, tags: PreparedSongTag[] = []) {
    const { userId, ...songData } = data;
    return prisma.$transaction(async (tx) => {
      const created = await tx.song.create({
        data: {
          ...songData,
          tenantId: this.tenantId,
          createdById: userId,
          updatedById: userId,
        },
        select: { id: true },
      });
      if (tags.length) await replaceSongTags(tx as unknown as Prisma.TransactionClient, this.tenantId, created.id, tags);
      const song = await tx.song.findFirstOrThrow({ where: { id: created.id }, select: songWithTagsSelect });
      return presentSong(song);
    });
  }

  async update(id: string, data: Prisma.SongUncheckedUpdateManyInput, tags?: PreparedSongTag[]) {
    return prisma.$transaction(async (tx) => {
      const result = await tx.song.updateMany({ where: { id, tenantId: this.tenantId }, data });
      if (!result.count) return null;
      if (tags) await replaceSongTags(tx as unknown as Prisma.TransactionClient, this.tenantId, id, tags);
      const song = await tx.song.findFirst({
        where: { id, tenantId: this.tenantId, isActive: true, deletedAt: null },
        select: songWithTagsSelect,
      });
      return song ? presentSong(song) : null;
    });
  }

  async delete(id: string) {
    const result = await prisma.song.updateMany({
      where: { id, tenantId: this.tenantId, isActive: true, deletedAt: null },
      data: { isActive: false, deletedAt: new Date() },
    });
    return result.count;
  }
}
