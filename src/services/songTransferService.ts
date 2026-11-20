import { normalizeChordText } from "../utils/chordText";
import { createHash } from "node:crypto";
import { Role } from "@prisma/client";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../errors/AppError";
import { prisma } from "../repositories/prismaClient";
import { PreparedSongTag, prepareSongTags, sortSongTagNames } from "../constants/songTags";
import { SongTransferExistingMode, SongTransferField } from "../constants/songTransferFields";
import { cleanCatalogText, normalizeCatalogText } from "../utils/catalogNormalization";
import { resolveSongTags } from "../repositories/songTagRepository";
import { SongRepository } from "../repositories/songRepository";
import {
  legacySongTransferFields,
  PortableSong,
  SongTransferCommitInput,
  SongTransferDocument,
  SongTransferExportInput,
  SongTransferPreviewInput,
} from "../validators/songTransfer.schema";

type RequestUser = { id: string; role: Role; tenantId?: string };
type PreviewStatus = "CREATE" | "UPDATE" | "LINK" | "RESTORE" | "ALREADY_LINKED" | "SKIPPED" | "CONFLICT" | "INVALID";
type TransferOptions = { fields: Set<SongTransferField>; fieldList: SongTransferField[]; existing: SongTransferExistingMode };
const actionable = new Set<PreviewStatus>(["CREATE", "UPDATE", "LINK", "RESTORE"]);
const urlFields = ["cifraUrl", "letraUrl", "audioUrl", "videoUrl"] as const;
const COMMIT_CHUNK_SIZE = 50;

type ExistingSong = {
  id: string;
  title: string;
  originalKey: string;
  content: string;
  cifraUrl: string | null;
  isActive: boolean;
  deletedAt: Date | null;
  artist: { name: string; normalizedName: string };
  ministries: Array<{ isActive: boolean; deletedAt: Date | null }>;
};

function normalizedContent(value: string): string {
  return normalizeChordText(value).replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").trim();
}

function normalizedUrl(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function identity(song: Pick<PortableSong, "title" | "artist">): string {
  return `${normalizeCatalogText(song.artist)}\u0000${normalizeCatalogText(song.title)}`;
}

function documentHash(document: SongTransferDocument, ministryId: string, items: unknown, options: TransferOptions): string {
  return createHash("sha256").update(JSON.stringify({
    document,
    ministryId,
    items,
    options: { fields: options.fieldList, existing: options.existing },
  }), "utf8").digest("hex");
}

function resolveOptions(input: { fields?: SongTransferField[]; existing?: SongTransferExistingMode }): TransferOptions {
  const fieldList = [...(input.fields ?? legacySongTransferFields)].sort() as SongTransferField[];
  return {
    fields: new Set(fieldList),
    fieldList,
    existing: input.existing ?? "create",
  };
}

function provided(song: PortableSong, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(song, field);
}

function canCreate(song: PortableSong, fields: Set<SongTransferField>): boolean {
  return fields.has("originalKey") && Boolean(song.originalKey) && fields.has("content") && Boolean(song.content);
}

function songDifferences(existing: ExistingSong, incoming: PortableSong, fields: Set<SongTransferField>): string[] {
  const differences: string[] = [];
  if (fields.has("originalKey") && incoming.originalKey && existing.originalKey !== incoming.originalKey) differences.push("tom");
  if (fields.has("content") && incoming.content && normalizedContent(existing.content) !== normalizedContent(incoming.content)) differences.push("cifra");
  if (fields.has("cifraUrl") && provided(incoming, "cifraUrl") && normalizedUrl(existing.cifraUrl) !== normalizedUrl(incoming.cifraUrl)) differences.push("link");
  return differences;
}

function classify(existing: ExistingSong | undefined, incoming: PortableSong, options: TransferOptions): { status: PreviewStatus; reason?: string; differences?: string[] } {
  if (!existing) {
    return canCreate(incoming, options.fields)
      ? { status: "CREATE" }
      : { status: "INVALID", reason: "Tom e cifra são obrigatórios para criar a música" };
  }
  if (options.existing === "skip") return { status: "SKIPPED" };
  if (options.existing === "update") return { status: "UPDATE" };
  const differences = songDifferences(existing, incoming, options.fields);
  if (differences.length) {
    return { status: "CONFLICT", reason: `Já existe uma música com conteúdo diferente: ${differences.join(", ")}`, differences };
  }
  if (!existing.isActive || existing.deletedAt) return { status: "RESTORE" };
  const link = existing.ministries[0];
  if (link?.isActive && !link.deletedAt) return { status: "ALREADY_LINKED" };
  return { status: "LINK" };
}

function selectedScalars(incoming: PortableSong, fields: Set<SongTransferField>, creating: boolean): Record<string, string | number | null> {
  const data: Record<string, string | number | null> = {};
  if (fields.has("originalKey") && incoming.originalKey) data.originalKey = incoming.originalKey;
  if (fields.has("content") && incoming.content) data.content = incoming.content;
  for (const key of urlFields) {
    if (!fields.has(key)) continue;
    if (creating && key === "cifraUrl") {
      data.cifraUrl = normalizedUrl(incoming.cifraUrl);
      continue;
    }
    if (provided(incoming, key)) data[key] = normalizedUrl(incoming[key]);
  }
  if (fields.has("bpm") && provided(incoming, "bpm")) data.bpm = incoming.bpm ?? null;
  if (fields.has("comments") && provided(incoming, "comments")) data.comments = incoming.comments ?? null;
  return data;
}

const MAX_EXPORT_SONGS = 2000;
const EXPORT_BATCH_SIZE = 250;

export class SongTransferService {
  constructor(private readonly user: RequestUser) {}

  async export(input: SongTransferExportInput): Promise<SongTransferDocument> {
    const tenantId = await this.ensureMinistryAccess(input.ministryId);
    const options = resolveOptions(input);
    const where = {
      tenantId,
      ministryId: input.ministryId,
      isActive: true,
      deletedAt: null,
      ...(input.songIds?.length ? { songId: { in: input.songIds } } : {}),
      song: { isActive: true, deletedAt: null },
    };

    const total = await prisma.ministrySong.count({ where });
    if (input.songIds && total !== input.songIds.length) {
      throw new NotFoundError("Uma ou mais músicas não pertencem ao ministério selecionado");
    }
    if (!total) throw new NotFoundError("O ministério selecionado ainda não possui músicas para exportar");
    if (total > MAX_EXPORT_SONGS) {
      throw new ValidationError(`A exportação está limitada a ${MAX_EXPORT_SONGS} músicas por vez.`);
    }

    const songs: PortableSong[] = [];
    for (let offset = 0; offset < total; offset += EXPORT_BATCH_SIZE) {
      const batch = await prisma.ministrySong.findMany({
        where,
        select: {
          songId: true,
          song: {
            select: {
              title: true,
              originalKey: true,
              content: true,
              bpm: true,
              cifraUrl: true,
              letraUrl: true,
              audioUrl: true,
              videoUrl: true,
              comments: true,
              artist: { select: { name: true } },
              tags: { select: { tag: { select: { name: true } } } },
            },
          },
        },
        orderBy: [{ song: { title: "asc" } }, { songId: "asc" }],
        skip: offset,
        take: EXPORT_BATCH_SIZE,
      });
      if (!batch.length) break;

      for (const { song } of batch) {
        const tags = sortSongTagNames(song.tags.map((link) => link.tag.name));
        const exported: PortableSong = { title: song.title, artist: song.artist.name };
        if (options.fields.has("originalKey")) exported.originalKey = song.originalKey as PortableSong["originalKey"];
        if (options.fields.has("content")) exported.content = normalizeChordText(song.content);
        if (options.fields.has("bpm")) exported.bpm = song.bpm;
        if (options.fields.has("cifraUrl")) exported.cifraUrl = song.cifraUrl;
        if (options.fields.has("letraUrl")) exported.letraUrl = song.letraUrl;
        if (options.fields.has("audioUrl")) exported.audioUrl = song.audioUrl;
        if (options.fields.has("videoUrl")) exported.videoUrl = song.videoUrl;
        if (options.fields.has("comments")) exported.comments = song.comments;
        if (options.fields.has("tags")) exported.tags = tags;
        songs.push(exported);
      }
    }

    if (!songs.length) throw new NotFoundError("O ministério selecionado ainda não possui músicas para exportar");

    return {
      format: "lauda.music-catalog",
      version: 1,
      songs,
    };
  }

  async preview(input: SongTransferPreviewInput) {
    const tenantId = await this.ensureMinistryAccess(input.ministryId);
    const options = resolveOptions(input);
    const incomingIdentities = new Set(input.document.songs.map(identity));
    const normalizedArtists = [...new Set(input.document.songs.map((song) => normalizeCatalogText(song.artist)))];
    const existingSongs = await prisma.song.findMany({
      where: {
        tenantId,
        artist: { normalizedName: { in: normalizedArtists } },
      },
      select: {
        id: true,
        title: true,
        normalizedTitle: true,
        originalKey: true,
        content: true,
        cifraUrl: true,
        isActive: true,
        deletedAt: true,
        artist: { select: { name: true, normalizedName: true } },
        ministries: {
          where: { ministryId: input.ministryId },
          select: { isActive: true, deletedAt: true },
        },
      },
    });
    const existingByIdentity = new Map(existingSongs.map((song) => [
      `${song.artist.normalizedName}\u0000${song.normalizedTitle}`,
      song,
    ]));
    const seen = new Set<string>();
    const items = input.document.songs.map((song, index) => {
      const key = identity(song);
      const duplicate = seen.has(key);
      seen.add(key);
      if (duplicate) {
        return { index, title: song.title, artist: song.artist, status: "INVALID" as PreviewStatus, reason: "Música repetida no arquivo" };
      }

      const existing = existingByIdentity.get(key) as ExistingSong | undefined;
      const decision = classify(existing, song, options);
      return { index, title: song.title, artist: song.artist, ...decision };
    });

    const counts = items.reduce<Record<PreviewStatus, number>>((result, item) => {
      result[item.status] += 1;
      return result;
    }, { CREATE: 0, UPDATE: 0, LINK: 0, RESTORE: 0, ALREADY_LINKED: 0, SKIPPED: 0, CONFLICT: 0, INVALID: 0 });

    return {
      documentHash: documentHash(input.document, input.ministryId, items, options),
      total: input.document.songs.length,
      unique: incomingIdentities.size,
      counts,
      items,
    };
  }

  async commit(input: SongTransferCommitInput) {
    const options = resolveOptions(input);
    const preview = await this.preview(input);
    if (preview.documentHash !== input.documentHash) {
      throw new ConflictError("O arquivo, ministério ou catálogo mudou depois da revisão. Selecione o arquivo e revise novamente antes de importar");
    }
    const tenantId = this.requireTenantId();
    const songSelect = {
      id: true,
      title: true,
      normalizedTitle: true,
      originalKey: true,
      content: true,
      cifraUrl: true,
      isActive: true,
      deletedAt: true,
      artist: { select: { name: true, normalizedName: true } },
      ministries: { where: { ministryId: input.ministryId }, select: { isActive: true, deletedAt: true } },
    } as const;
    type CommitExistingSong = ExistingSong & { normalizedTitle: string };

    const result = await prisma.$transaction(async (tx) => {
      const counts = {
        created: 0, updated: 0, linked: 0, restored: 0, skipped: preview.counts.SKIPPED,
        alreadyLinked: preview.counts.ALREADY_LINKED, conflicts: preview.counts.CONFLICT, invalid: preview.counts.INVALID,
      };

      const rawActionable = input.document.songs
        .map((incoming, index) => ({ incoming, previewItem: preview.items[index] }))
        .filter((entry): entry is { incoming: PortableSong; previewItem: NonNullable<typeof preview.items[number]> } => (
          Boolean(entry.previewItem) && actionable.has(entry.previewItem.status)
        ))
        .map(({ incoming, previewItem }) => {
          const artistName = cleanCatalogText(incoming.artist);
          const title = cleanCatalogText(incoming.title);
          return {
            incoming,
            previewItem,
            artistName,
            normalizedArtist: normalizeCatalogText(artistName),
            title,
            normalizedTitle: normalizeCatalogText(title),
          };
        });

      if (!rawActionable.length) return counts;

      // Batch-fetch all existing artists and existing songs referenced by actionable items upfront.
      const normalizedArtists = Array.from(new Set(rawActionable.map((entry) => entry.normalizedArtist)));
      const existingArtists = await tx.artist.findMany({
        where: { tenantId, normalizedName: { in: normalizedArtists } },
        select: { id: true, name: true, normalizedName: true, isActive: true, deletedAt: true },
      });
      const artistByNormalized = new Map(existingArtists.map((artist) => [artist.normalizedName, artist]));

      const existingArtistIds = existingArtists.map((artist) => artist.id);
      const normalizedTitles = Array.from(new Set(rawActionable.map((entry) => entry.normalizedTitle)));
      const existingSongs = existingArtistIds.length && normalizedTitles.length
        ? (await tx.song.findMany({
            where: {
              tenantId,
              artistId: { in: existingArtistIds },
              normalizedTitle: { in: normalizedTitles },
            },
            select: songSelect,
          })) as CommitExistingSong[]
        : [];
      const songByKey = new Map(
        existingSongs.map((song) => [`${song.artist.normalizedName}\u0000${song.normalizedTitle}`, song]),
      );

      // Re-validate all items before writing anything so conflicts abort immediately.
      type PlannedEntry = (typeof rawActionable)[number] & {
        existingSong: CommitExistingSong | null;
        decisionStatus: PreviewStatus;
      };
      const plannedEntries: PlannedEntry[] = [];
      const missingArtistsByNormalized = new Map<string, string>();
      const inactiveArtistsById = new Map<string, { currentName: string; targetName: string }>();

      for (const entry of rawActionable) {
        const song = songByKey.get(`${entry.normalizedArtist}\u0000${entry.normalizedTitle}`) ?? null;
        const decision = classify(song ?? undefined, entry.incoming, options);
        if (decision.status !== entry.previewItem.status) {
          if (decision.status === "ALREADY_LINKED" && entry.previewItem.status === "LINK") {
            counts.alreadyLinked += 1;
            continue;
          }
          throw new ConflictError("Uma música mudou durante a importação. Nenhuma alteração foi aplicada. Revise o arquivo novamente");
        }
        if (!actionable.has(decision.status) || (!song && decision.status !== "CREATE")) continue;

        const artist = artistByNormalized.get(entry.normalizedArtist);
        if (!artist) {
          if (!missingArtistsByNormalized.has(entry.normalizedArtist)) {
            missingArtistsByNormalized.set(entry.normalizedArtist, entry.artistName);
          }
        } else if ((!artist.isActive || artist.deletedAt) && !inactiveArtistsById.has(artist.id)) {
          inactiveArtistsById.set(artist.id, { currentName: artist.name, targetName: entry.artistName });
        }

        plannedEntries.push({ ...entry, existingSong: song, decisionStatus: decision.status });
      }

      if (!plannedEntries.length) return counts;

      // Batch-create missing artists and batch-reactivate soft-deleted artists.
      if (missingArtistsByNormalized.size) {
        const orderedMissing = Array.from(missingArtistsByNormalized.entries())
          .sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
        const createdArtists = await tx.artist.createManyAndReturn({
          data: orderedMissing.map(([normalizedName, name]) => ({ tenantId, name, normalizedName })),
          select: { id: true, name: true, normalizedName: true, isActive: true, deletedAt: true },
        });
        for (const created of createdArtists) {
          artistByNormalized.set(created.normalizedName, created);
        }
      }

      if (inactiveArtistsById.size) {
        const sameNameArtistIds: string[] = [];
        const renameArtists: Array<{ id: string; name: string }> = [];
        for (const [id, info] of inactiveArtistsById) {
          if (info.currentName === info.targetName) {
            sameNameArtistIds.push(id);
          } else {
            renameArtists.push({ id, name: info.targetName });
          }
        }
        if (sameNameArtistIds.length) {
          await tx.artist.updateMany({
            where: { id: { in: sameNameArtistIds } },
            data: { isActive: true, deletedAt: null },
          });
        }
        for (const artist of renameArtists) {
          await tx.artist.update({
            where: { id: artist.id },
            data: { name: artist.name, isActive: true, deletedAt: null },
          });
        }
      }

      // Pre-resolve all distinct tags needed across the import in deterministic order.
      const preparedTagsByEntry = new Map<number, PreparedSongTag[]>();
      const uniquePreparedTags = new Map<string, PreparedSongTag>();
      for (const [index, entry] of plannedEntries.entries()) {
        // An empty list clears tags in update mode. An omitted field preserves them.
        const shouldImportTags = entry.decisionStatus === "CREATE"
          ? Boolean(entry.incoming.tags?.length)
          : entry.decisionStatus === "UPDATE" && provided(entry.incoming, "tags");
        if (options.fields.has("tags") && shouldImportTags) {
          const prepared = prepareSongTags(entry.incoming.tags ?? []);
          preparedTagsByEntry.set(index, prepared);
          for (const tag of prepared) {
            if (!uniquePreparedTags.has(tag.normalizedName)) {
              uniquePreparedTags.set(tag.normalizedName, tag);
            }
          }
        }
      }

      let tagIdByNormalized = new Map<string, string>();
      if (uniquePreparedTags.size) {
        const allPrepared = Array.from(uniquePreparedTags.values());
        await resolveSongTags(tx, tenantId, allPrepared, true);
        const resolvedTagRows = await tx.songTag.findMany({
          where: { tenantId, normalizedName: { in: allPrepared.map((tag) => tag.normalizedName) } },
          select: { id: true, normalizedName: true },
        });
        tagIdByNormalized = new Map(resolvedTagRows.map((row) => [row.normalizedName, row.id]));
      }

      // Process mutations in bounded chunks with batched inserts, updates, tag links and ministry links.
      for (let start = 0; start < plannedEntries.length; start += COMMIT_CHUNK_SIZE) {
        const chunk = plannedEntries.slice(start, start + COMMIT_CHUNK_SIZE);
        const resolvedSongIds = new Array<string | null>(chunk.length).fill(null);

        const creates: Array<{
          chunkIndex: number;
          artistId: string;
          normalizedTitle: string;
          data: {
            tenantId: string;
            title: string;
            normalizedTitle: string;
            artistId: string;
            originalKey: string;
            content: string;
            cifraUrl: string | null;
            letraUrl?: string | null;
            audioUrl?: string | null;
            videoUrl?: string | null;
            bpm?: number | null;
            comments?: string | null;
            createdById: string;
            updatedById: string;
          };
        }> = [];
        const updates: Array<{
          chunkIndex: number;
          songId: string;
          inactive: boolean;
          scalars: Record<string, string | number | null>;
        }> = [];
        const restores: Array<{ chunkIndex: number; songId: string }> = [];

        chunk.forEach((entry, chunkIndex) => {
          const scalars = selectedScalars(entry.incoming, options.fields, entry.decisionStatus === "CREATE");
          if (!entry.existingSong) {
            const artist = artistByNormalized.get(entry.normalizedArtist);
            if (!artist) {
              throw new ConflictError("Falha ao resolver artista durante a importação.");
            }
            creates.push({
              chunkIndex,
              artistId: artist.id,
              normalizedTitle: entry.normalizedTitle,
              data: {
                tenantId,
                title: entry.title,
                normalizedTitle: entry.normalizedTitle,
                artistId: artist.id,
                originalKey: String(scalars.originalKey),
                content: String(scalars.content),
                cifraUrl: typeof scalars.cifraUrl === "string" ? scalars.cifraUrl : null,
                ...(typeof scalars.letraUrl === "string" || scalars.letraUrl === null ? { letraUrl: scalars.letraUrl } : {}),
                ...(typeof scalars.audioUrl === "string" || scalars.audioUrl === null ? { audioUrl: scalars.audioUrl } : {}),
                ...(typeof scalars.videoUrl === "string" || scalars.videoUrl === null ? { videoUrl: scalars.videoUrl } : {}),
                ...(typeof scalars.bpm === "number" || scalars.bpm === null ? { bpm: scalars.bpm } : {}),
                ...(typeof scalars.comments === "string" || scalars.comments === null ? { comments: scalars.comments } : {}),
                createdById: this.user.id,
                updatedById: this.user.id,
              },
            });
          } else if (entry.decisionStatus === "UPDATE") {
            const inactive = !entry.existingSong.isActive || Boolean(entry.existingSong.deletedAt);
            updates.push({
              chunkIndex,
              songId: entry.existingSong.id,
              inactive,
              scalars,
            });
          } else {
            resolvedSongIds[chunkIndex] = entry.existingSong.id;
            if (!entry.existingSong.isActive || entry.existingSong.deletedAt) {
              restores.push({ chunkIndex, songId: entry.existingSong.id });
            }
          }
        });

        if (creates.length) {
          const createdSongs = await tx.song.createManyAndReturn({
            data: creates.map((item) => item.data),
            select: { id: true, artistId: true, normalizedTitle: true },
          });
          const createdIdByKey = new Map(
            createdSongs.map((song) => [`${song.artistId}\u0000${song.normalizedTitle}`, song.id]),
          );
          for (const item of creates) {
            const createdId = createdIdByKey.get(`${item.artistId}\u0000${item.normalizedTitle}`) ?? null;
            resolvedSongIds[item.chunkIndex] = createdId;
          }
          counts.created += createdSongs.length;
        }

        for (const item of updates) {
          await tx.song.update({
            where: { id: item.songId },
            data: {
              ...item.scalars,
              ...(item.inactive ? { isActive: true, deletedAt: null } : {}),
              updatedById: this.user.id,
            },
          });
          resolvedSongIds[item.chunkIndex] = item.songId;
          counts.updated += 1;
          if (item.inactive) counts.restored += 1;
        }

        if (restores.length) {
          await tx.song.updateMany({
            where: { id: { in: restores.map((item) => item.songId) } },
            data: { isActive: true, deletedAt: null, updatedById: this.user.id },
          });
          counts.restored += restores.length;
        }

        // Batch-replace tags for updated songs and attach tags for created songs in this chunk.
        const existingTagSongIdsToClear: string[] = [];
        const tagAssignmentsToCreate: Array<{ tenantId: string; songId: string; tagId: string }> = [];
        const linksToReactivate: string[] = [];
        const linksToCreate: string[] = [];

        chunk.forEach((entry, chunkIndex) => {
          const songId = resolvedSongIds[chunkIndex];
          if (!songId) return;

          const preparedTags = preparedTagsByEntry.get(start + chunkIndex);
          if (preparedTags) {
            if (entry.existingSong) existingTagSongIdsToClear.push(songId);
            for (const tag of preparedTags) {
              const tagId = tagIdByNormalized.get(tag.normalizedName);
              if (tagId) {
                tagAssignmentsToCreate.push({ tenantId, songId, tagId });
              }
            }
          }

          const currentLink = entry.existingSong?.ministries[0];
          if (!currentLink) {
            linksToCreate.push(songId);
            counts.linked += 1;
          } else if (!currentLink.isActive || currentLink.deletedAt) {
            linksToReactivate.push(songId);
            counts.linked += 1;
          }
        });

        if (existingTagSongIdsToClear.length) {
          await tx.songTagAssignment.deleteMany({
            where: { tenantId, songId: { in: existingTagSongIdsToClear } },
          });
        }
        if (tagAssignmentsToCreate.length) {
          await tx.songTagAssignment.createMany({
            data: tagAssignmentsToCreate,
            skipDuplicates: true,
          });
        }
        if (linksToReactivate.length) {
          await tx.ministrySong.updateMany({
            where: { ministryId: input.ministryId, songId: { in: linksToReactivate } },
            data: { isActive: true, deletedAt: null },
          });
        }
        if (linksToCreate.length) {
          await tx.ministrySong.createMany({
            data: linksToCreate.map((songId) => ({ tenantId, songId, ministryId: input.ministryId })),
            skipDuplicates: true,
          });
        }
      }

      return counts;
    }, { timeout: 120_000 });

    SongRepository.invalidateTagCountsCache(tenantId);
    return { ...result, total: input.document.songs.length, documentHash: preview.documentHash };
  }

  private requireTenantId(): string {
    if (!this.user.tenantId) throw new ForbiddenError("Selecione uma igreja antes de importar ou exportar músicas");
    return this.user.tenantId;
  }

  private async ensureMinistryAccess(ministryId: string): Promise<string> {
    const tenantId = this.requireTenantId();
    const ministry = await prisma.ministry.findFirst({
      where: { id: ministryId, tenantId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!ministry) throw new NotFoundError("Ministério não encontrado");
    if (this.user.role === Role.GLOBAL_ADMIN || this.user.role === Role.TENANT_ADMIN) return tenantId;

    const membership = await prisma.ministryMember.findFirst({
      where: {
        tenantId,
        ministryId,
        userId: this.user.id,
        status: "ACTIVE",
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!membership) throw new ForbiddenError("Usuário sem acesso ao ministério selecionado");
    return tenantId;
  }
}
