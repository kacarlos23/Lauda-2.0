import { Prisma } from "@prisma/client";
import { NotFoundError } from "../errors/AppError";
import { PreparedSongTag, prepareSongTags, sortSongTagNames } from "../constants/songTags";
import { normalizeCatalogText } from "../utils/catalogNormalization";
import { prisma } from "./prismaClient";
import { applySongTagChanges, lockActiveSongs, replaceSongTags, resolveSongTags } from "./songTagRepository";
import { SongListInput, SongScopeInput, SongTagBatchInput, SongTagChangeInput } from "../validators/song.schema";
import { foldThemeSearch, parseSongSearch } from "../utils/songSearch";

export const songSummarySelect = {
  id: true,
  title: true,
  composer: true,
  originalKey: true,
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

const songSummaryWithTagsSelect = {
  ...songSummarySelect,
  tags: { select: { tag: { select: { name: true } } } },
} satisfies Prisma.SongSelect;

export const songSelect = {
  ...songSummarySelect,
  content: true,
  comments: true,
} satisfies Prisma.SongSelect;

const songWithTagsSelect = {
  ...songSelect,
  tags: { select: { tag: { select: { name: true } } } },
} satisfies Prisma.SongSelect;

function presentSong<T extends { tags: Array<{ tag: { name: string } }> }>(song: T) {
  const { tags, ...rest } = song;
  return { ...rest, tags: sortSongTagNames(tags.map((link) => link.tag.name)) };
}

type TagCountsResult = {
  items: Array<{ id: string; name: string; count: number }>;
  untaggedCount: number;
};

const TAG_COUNTS_CACHE_TTL_MS = 10_000;
const tagCountsCache = new Map<string, { expiresAt: number; value: TagCountsResult }>();

function buildTagCountsCacheKey(tenantId: string, input: SongScopeInput): string {
  return `${tenantId}::${JSON.stringify({
    artistId: input.artistId ?? null,
    originalKey: input.originalKey ?? null,
    ministryId: input.ministryId ?? null,
    search: input.search?.trim() || null,
  })}`;
}

export class SongRepository {
  constructor(private readonly tenantId: string) {}

  static invalidateTagCountsCache(tenantId?: string): void {
    if (!tenantId) {
      tagCountsCache.clear();
      return;
    }
    const prefix = `${tenantId}::`;
    for (const key of tagCountsCache.keys()) {
      if (key.startsWith(prefix)) tagCountsCache.delete(key);
    }
  }

  resolveScope(input: SongScopeInput): Promise<Prisma.SongWhereInput> {
    return this.scope(input, prisma);
  }

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

  async list(input: SongListInput, precomputedScope?: Prisma.SongWhereInput) {
    const scope = precomputedScope ?? (await this.scope(input, prisma));
    const themes: Prisma.SongWhereInput[] = [];
    if (input.tags?.length) themes.push(this.matchesThemes(input.tags.map(normalizeCatalogText)));
    if (input.untagged) themes.push(this.withoutThemes());
    const where = themes.length ? { ...scope, AND: { OR: themes } } : scope;
    const [items, total] = await Promise.all([
      prisma.song.findMany({
        where,
        select: songSummaryWithTagsSelect,
        orderBy: [{ title: "asc" }, { id: "asc" }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      prisma.song.count({ where }),
    ]);
    return { items: items.map(presentSong), total };
  }

  async listTags(input: SongScopeInput, precomputedScope?: Prisma.SongWhereInput): Promise<TagCountsResult> {
    const cacheKey = buildTagCountsCacheKey(this.tenantId, input);
    const now = Date.now();
    const cached = tagCountsCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const scope = precomputedScope ?? (await this.scope(input, prisma));
    const [tags, untaggedCount] = await Promise.all([
      prisma.songTag.findMany({
        where: { tenantId: this.tenantId },
        select: {
          id: true,
          name: true,
          _count: { select: { songs: { where: { tenantId: this.tenantId, song: scope } } } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.song.count({ where: { ...scope, ...this.withoutThemes() } }),
    ]);
    const items = tags.map(({ _count, ...tag }) => ({ ...tag, count: _count.songs }));
    const value: TagCountsResult = { items, untaggedCount };
    tagCountsCache.set(cacheKey, { expiresAt: now + TAG_COUNTS_CACHE_TTL_MS, value });
    return value;
  }

  async changeTag(id: string, userId: string, { name, operation }: SongTagChangeInput) {
    const item = await prisma.$transaction(async (db) => {
      await lockActiveSongs(db, this.tenantId, [id]);
      const tags = await resolveSongTags(db, this.tenantId, prepareSongTags([name]), operation === "add");
      const result = await applySongTagChanges(db, this.tenantId, userId, [id], tags, operation);
      return result.items[0];
    });
    SongRepository.invalidateTagCountsCache(this.tenantId);
    return item;
  }

  async changeTags(userId: string, { songIds, tagIds, newTags, operation }: SongTagBatchInput) {
    const result = await prisma.$transaction(async (db) => {
      await lockActiveSongs(db, this.tenantId, songIds);
      const existing = await db.songTag.findMany({
        where: { tenantId: this.tenantId, id: { in: tagIds } },
        select: { id: true, name: true },
      });
      if (existing.length !== tagIds.length) throw new NotFoundError("Um ou mais temas não foram encontrados");
      const added = await resolveSongTags(db, this.tenantId, prepareSongTags(newTags), operation === "add");
      return applySongTagChanges(db, this.tenantId, userId, songIds, [...existing, ...added], operation);
    });
    SongRepository.invalidateTagCountsCache(this.tenantId);
    return result;
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

  async create(data: {
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
    const createdSong = await prisma.$transaction(async (tx) => {
      const created = await tx.song.create({
        data: {
          ...songData,
          tenantId: this.tenantId,
          createdById: userId,
          updatedById: userId,
        },
        select: { id: true },
      });
      if (tags.length) await replaceSongTags(tx, this.tenantId, created.id, tags);
      const song = await tx.song.findFirstOrThrow({ where: { id: created.id }, select: songWithTagsSelect });
      return presentSong(song);
    });
    SongRepository.invalidateTagCountsCache(this.tenantId);
    return createdSong;
  }

  async update(id: string, data: Prisma.SongUncheckedUpdateManyInput, tags?: PreparedSongTag[]) {
    const updatedSong = await prisma.$transaction(async (tx) => {
      const result = await tx.song.updateMany({
        where: { id, tenantId: this.tenantId, isActive: true, deletedAt: null }, data,
      });
      if (!result.count) return null;
      if (tags) await replaceSongTags(tx, this.tenantId, id, tags);
      const song = await tx.song.findFirst({
        where: { id, tenantId: this.tenantId, isActive: true, deletedAt: null },
        select: songWithTagsSelect,
      });
      return song ? presentSong(song) : null;
    });
    if (updatedSong) SongRepository.invalidateTagCountsCache(this.tenantId);
    return updatedSong;
  }

  async delete(id: string) {
    const result = await prisma.song.updateMany({
      where: { id, tenantId: this.tenantId, isActive: true, deletedAt: null },
      data: { isActive: false, deletedAt: new Date() },
    });
    if (result.count > 0) SongRepository.invalidateTagCountsCache(this.tenantId);
    return result.count;
  }
}
