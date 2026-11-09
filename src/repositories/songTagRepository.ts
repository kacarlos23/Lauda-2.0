import { Prisma } from "@prisma/client";
import { PreparedSongTag } from "../constants/songTags";

export async function replaceSongTags(
  db: Prisma.TransactionClient,
  tenantId: string,
  songId: string,
  tags: PreparedSongTag[],
) {
  const tagIds: string[] = [];
  for (const tag of tags) {
    const saved = await db.songTag.upsert({
      where: { tenantId_normalizedName: { tenantId, normalizedName: tag.normalizedName } },
      create: { tenantId, name: tag.name, normalizedName: tag.normalizedName },
      update: {},
      select: { id: true },
    });
    tagIds.push(saved.id);
  }
  await db.songTagAssignment.deleteMany({ where: { songId, tenantId } });
  if (tagIds.length) {
    await db.songTagAssignment.createMany({
      data: tagIds.map((tagId) => ({ songId, tagId, tenantId })),
    });
  }
}
