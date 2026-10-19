import { createHash } from "node:crypto";
import { Role } from "@prisma/client";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors/AppError";
import { prisma } from "../repositories/prismaClient";
import { cleanCatalogText, normalizeCatalogText } from "../utils/catalogNormalization";
import {
  PortableSong,
  SongTransferCommitInput,
  SongTransferDocument,
  SongTransferExportInput,
  SongTransferPreviewInput,
} from "../validators/songTransfer.schema";

type RequestUser = { id: string; role: Role; tenantId?: string };
type PreviewStatus = "CREATE" | "LINK" | "RESTORE" | "ALREADY_LINKED" | "CONFLICT" | "INVALID";

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
  return value.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trim();
}

function normalizedUrl(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function identity(song: Pick<PortableSong, "title" | "artist">): string {
  return `${normalizeCatalogText(song.artist)}\u0000${normalizeCatalogText(song.title)}`;
}

function documentHash(document: SongTransferDocument): string {
  return createHash("sha256").update(JSON.stringify(document), "utf8").digest("hex");
}

function songDifferences(existing: ExistingSong, incoming: PortableSong): string[] {
  const differences: string[] = [];
  if (existing.originalKey !== incoming.originalKey) differences.push("tom");
  if (normalizedContent(existing.content) !== normalizedContent(incoming.content)) differences.push("cifra");
  if (normalizedUrl(existing.cifraUrl) !== normalizedUrl(incoming.cifraUrl)) differences.push("link");
  return differences;
}

export class SongTransferService {
  constructor(private readonly user: RequestUser) {}

  async export(input: SongTransferExportInput): Promise<SongTransferDocument> {
    const tenantId = await this.ensureMinistryAccess(input.ministryId);
    const links = await prisma.ministrySong.findMany({
      where: {
        tenantId,
        ministryId: input.ministryId,
        isActive: true,
        deletedAt: null,
        ...(input.songIds?.length ? { songId: { in: input.songIds } } : {}),
        song: { isActive: true, deletedAt: null },
      },
      select: {
        songId: true,
        song: {
          select: {
            title: true,
            originalKey: true,
            content: true,
            cifraUrl: true,
            artist: { select: { name: true } },
          },
        },
      },
      orderBy: [{ song: { title: "asc" } }],
    });

    if (input.songIds && links.length !== input.songIds.length) {
      throw new NotFoundError("Uma ou mais músicas não pertencem ao ministério selecionado");
    }
    if (!links.length) throw new NotFoundError("O ministério selecionado ainda não possui músicas para exportar");

    return {
      format: "lauda.music-catalog",
      version: 1,
      songs: links.map(({ song }) => ({
        title: song.title,
        artist: song.artist.name,
        originalKey: song.originalKey as PortableSong["originalKey"],
        content: song.content,
        cifraUrl: song.cifraUrl,
      })),
    };
  }

  async preview(input: SongTransferPreviewInput) {
    const tenantId = await this.ensureMinistryAccess(input.ministryId);
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
      if (!existing) return { index, title: song.title, artist: song.artist, status: "CREATE" as PreviewStatus };

      const differences = songDifferences(existing, song);
      if (differences.length) {
        return {
          index,
          title: song.title,
          artist: song.artist,
          status: "CONFLICT" as PreviewStatus,
          reason: `Já existe uma música com conteúdo diferente: ${differences.join(", ")}`,
          differences,
        };
      }
      if (!existing.isActive || existing.deletedAt) {
        return { index, title: song.title, artist: song.artist, status: "RESTORE" as PreviewStatus };
      }
      const link = existing.ministries[0];
      if (link?.isActive && !link.deletedAt) {
        return { index, title: song.title, artist: song.artist, status: "ALREADY_LINKED" as PreviewStatus };
      }
      return { index, title: song.title, artist: song.artist, status: "LINK" as PreviewStatus };
    });

    const counts = items.reduce<Record<PreviewStatus, number>>((result, item) => {
      result[item.status] += 1;
      return result;
    }, { CREATE: 0, LINK: 0, RESTORE: 0, ALREADY_LINKED: 0, CONFLICT: 0, INVALID: 0 });

    return {
      documentHash: documentHash(input.document),
      total: input.document.songs.length,
      unique: incomingIdentities.size,
      counts,
      items,
    };
  }

  async commit(input: SongTransferCommitInput) {
    const preview = await this.preview(input);
    if (preview.documentHash !== input.documentHash) {
      throw new ConflictError("O arquivo mudou depois da revisão. Revise novamente antes de importar");
    }
    const tenantId = this.requireTenantId();
    const allowedIndexes = new Set(preview.items
      .filter((item) => item.status === "CREATE" || item.status === "LINK" || item.status === "RESTORE")
      .map((item) => item.index));

    const result = await prisma.$transaction(async (tx) => {
      const counts = { created: 0, linked: 0, restored: 0, alreadyLinked: preview.counts.ALREADY_LINKED, conflicts: preview.counts.CONFLICT, invalid: preview.counts.INVALID };
      for (const [index, incoming] of input.document.songs.entries()) {
        if (!allowedIndexes.has(index)) continue;

        const artistName = cleanCatalogText(incoming.artist);
        const normalizedArtist = normalizeCatalogText(artistName);
        let artist = await tx.artist.findUnique({
          where: { tenantId_normalizedName: { tenantId, normalizedName: normalizedArtist } },
          select: { id: true, isActive: true, deletedAt: true },
        });
        if (!artist) {
          artist = await tx.artist.create({
            data: { tenantId, name: artistName, normalizedName: normalizedArtist },
            select: { id: true, isActive: true, deletedAt: true },
          });
        } else if (!artist.isActive || artist.deletedAt) {
          artist = await tx.artist.update({
            where: { id: artist.id },
            data: { name: artistName, isActive: true, deletedAt: null },
            select: { id: true, isActive: true, deletedAt: true },
          });
        }

        const title = cleanCatalogText(incoming.title);
        const normalizedTitle = normalizeCatalogText(title);
        let song = await tx.song.findUnique({
          where: { tenantId_artistId_normalizedTitle: { tenantId, artistId: artist.id, normalizedTitle } },
          select: { id: true, title: true, originalKey: true, content: true, cifraUrl: true, isActive: true, deletedAt: true, artist: { select: { name: true, normalizedName: true } }, ministries: { where: { ministryId: input.ministryId }, select: { isActive: true, deletedAt: true } } },
        }) as ExistingSong | null;

        if (song && songDifferences(song, incoming).length) {
          counts.conflicts += 1;
          continue;
        }
        if (!song) {
          song = await tx.song.create({
            data: {
              tenantId,
              title,
              normalizedTitle,
              artistId: artist.id,
              originalKey: incoming.originalKey,
              content: incoming.content,
              cifraUrl: normalizedUrl(incoming.cifraUrl),
              createdById: this.user.id,
              updatedById: this.user.id,
            },
            select: { id: true, title: true, originalKey: true, content: true, cifraUrl: true, isActive: true, deletedAt: true, artist: { select: { name: true, normalizedName: true } }, ministries: { where: { ministryId: input.ministryId }, select: { isActive: true, deletedAt: true } } },
          }) as ExistingSong;
          counts.created += 1;
        } else if (!song.isActive || song.deletedAt) {
          song = await tx.song.update({
            where: { id: song.id },
            data: { isActive: true, deletedAt: null, updatedById: this.user.id },
            select: { id: true, title: true, originalKey: true, content: true, cifraUrl: true, isActive: true, deletedAt: true, artist: { select: { name: true, normalizedName: true } }, ministries: { where: { ministryId: input.ministryId }, select: { isActive: true, deletedAt: true } } },
          }) as ExistingSong;
          counts.restored += 1;
        }

        const currentLink = song.ministries[0];
        await tx.ministrySong.upsert({
          where: { songId_ministryId: { songId: song.id, ministryId: input.ministryId } },
          update: { isActive: true, deletedAt: null },
          create: { tenantId, songId: song.id, ministryId: input.ministryId },
        });
        if (!currentLink?.isActive || currentLink.deletedAt) counts.linked += 1;
      }
      return counts;
    });

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
