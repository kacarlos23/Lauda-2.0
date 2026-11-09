import { Prisma } from "@prisma/client";
import { PreparedSongTag, SONG_TAGS_MAX, sortSongTagNames } from "../constants/songTags";
import { ConflictError, NotFoundError } from "../errors/AppError";
import type { SongTagOperation } from "../validators/song.schema";
import type { prisma } from "./prismaClient";

type TagDatabase = Pick<typeof prisma, "song" | "songTag" | "songTagAssignment" | "$queryRaw">;
type Tag = { id: string; name: string };

export async function resolveSongTags(db: TagDatabase, tenantId: string, tags: PreparedSongTag[], create: boolean): Promise<Tag[]> {
  if (!tags.length) return [];
  if (create) {
    const ordered = [...tags].sort((a, b) => a.normalizedName.localeCompare(b.normalizedName, "pt-BR"));
    await db.songTag.createMany({ data: ordered.map((tag) => ({ ...tag, tenantId })), skipDuplicates: true });
  }
  return db.songTag.findMany({
    where: { tenantId, normalizedName: { in: tags.map((tag) => tag.normalizedName) } },
    select: { id: true, name: true },
  });
}

export async function replaceSongTags(db: TagDatabase, tenantId: string, songId: string, tags: PreparedSongTag[]) {
  const saved = await resolveSongTags(db, tenantId, tags, true);
  await db.songTagAssignment.deleteMany({ where: { songId, tenantId } });
  if (saved.length) {
    await db.songTagAssignment.createMany({
      data: saved.map(({ id: tagId }) => ({ songId, tagId, tenantId })),
    });
  }
}

export async function lockActiveSongs(db: TagDatabase, tenantId: string, songIds: string[]) {
  // Lock the same rows as full song edits and deletions. A consistent order
  // also keeps overlapping selections from taking the locks in reverse order.
  const songs = await db.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Song"
    WHERE "tenantId" = ${tenantId} AND "id" IN (${Prisma.join(songIds)})
      AND "isActive" = true AND "deletedAt" IS NULL
    ORDER BY "id" FOR UPDATE
  `;
  if (songs.length !== songIds.length) {
    throw new NotFoundError("Uma ou mais músicas não foram encontradas");
  }
}

export async function applySongTagChanges(
  db: TagDatabase,
  tenantId: string,
  userId: string,
  songIds: string[],
  tags: Tag[],
  operation: SongTagOperation,
) {
  const links = await db.songTagAssignment.findMany({
    where: { tenantId, songId: { in: songIds }, tag: { tenantId } },
    select: { songId: true, tag: { select: { id: true, name: true } } },
  });
  const bySong = new Map(songIds.map((id) => [id, new Map<string, string>()]));
  for (const { songId, tag } of links) bySong.get(songId)?.set(tag.id, tag.name);

  const additions: { tenantId: string; songId: string; tagId: string }[] = [];
  const changed: string[] = [];
  for (const [songId, current] of bySong) {
    const size = current.size;
    for (const tag of tags) {
      if (operation === "remove") {
        current.delete(tag.id);
      } else if (!current.has(tag.id)) {
        current.set(tag.id, tag.name);
        additions.push({ tenantId, songId, tagId: tag.id });
      }
    }
    if (current.size > size && current.size > SONG_TAGS_MAX) {
      throw new ConflictError(`Uma música pode ter no máximo ${SONG_TAGS_MAX} temas.`);
    }
    if (current.size !== size) changed.push(songId);
  }

  if (additions.length) await db.songTagAssignment.createMany({ data: additions });
  if (operation === "remove" && changed.length) {
    await db.songTagAssignment.deleteMany({
      where: { tenantId, songId: { in: changed }, tagId: { in: tags.map((tag) => tag.id) } },
    });
  }
  if (changed.length) {
    await db.song.updateMany({ where: { tenantId, id: { in: changed } }, data: { updatedById: userId } });
  }
  return {
    items: [...bySong].map(([id, names]) => ({ id, tags: sortSongTagNames([...names.values()]) })),
    updated: changed.length,
  };
}
