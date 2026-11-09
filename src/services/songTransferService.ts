import { normalizeChordText } from "../utils/chordText";
import { createHash } from "node:crypto";
import { Role } from "@prisma/client";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors/AppError";
import { prisma } from "../repositories/prismaClient";
import { prepareSongTags, sortSongTagNames } from "../constants/songTags";
import { SongTransferExistingMode, SongTransferField } from "../constants/songTransferFields";
import { cleanCatalogText, normalizeCatalogText } from "../utils/catalogNormalization";
import { replaceSongTags } from "../repositories/songTagRepository";
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
type TransferOptions = { fields: Set<SongTransferField>; fieldList: SongTransferField[]; existing: SongTransferExistingMode; explicitFields: boolean };
const actionable = new Set<PreviewStatus>(["CREATE", "UPDATE", "LINK", "RESTORE"]);
const urlFields = ["cifraUrl", "letraUrl", "audioUrl", "videoUrl"] as const;

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
    explicitFields: input.fields != null,
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

export class SongTransferService {
  constructor(private readonly user: RequestUser) {}

  async export(input: SongTransferExportInput): Promise<SongTransferDocument> {
    const tenantId = await this.ensureMinistryAccess(input.ministryId);
    const options = resolveOptions(input);
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
      orderBy: [{ song: { title: "asc" } }],
    });

    if (input.songIds && links.length !== input.songIds.length) {
      throw new NotFoundError("Uma ou mais músicas não pertencem ao ministério selecionado");
    }
    if (!links.length) throw new NotFoundError("O ministério selecionado ainda não possui músicas para exportar");

    return {
      format: "lauda.music-catalog",
      version: 1,
      songs: links.map(({ song }) => {
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
        if (options.fields.has("tags") && (options.explicitFields || tags.length)) exported.tags = tags;
        return exported;
      }),
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
      id: true, title: true, originalKey: true, content: true, cifraUrl: true, isActive: true, deletedAt: true,
      artist: { select: { name: true, normalizedName: true } },
      ministries: { where: { ministryId: input.ministryId }, select: { isActive: true, deletedAt: true } },
    } as const;

    const result = await prisma.$transaction(async (tx) => {
      const counts = {
        created: 0, updated: 0, linked: 0, restored: 0, skipped: preview.counts.SKIPPED,
        alreadyLinked: preview.counts.ALREADY_LINKED, conflicts: preview.counts.CONFLICT, invalid: preview.counts.INVALID,
      };
      for (const [index, incoming] of input.document.songs.entries()) {
        const previewItem = preview.items[index];
        if (!previewItem || !actionable.has(previewItem.status)) continue;

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
          select: songSelect,
        }) as ExistingSong | null;
        const decision = classify(song ?? undefined, incoming, options);
        if (decision.status !== previewItem.status) {
          if (decision.status === "ALREADY_LINKED" && previewItem.status === "LINK") {
            counts.alreadyLinked += 1;
            continue;
          }
          throw new ConflictError("Uma música mudou durante a importação. Nenhuma alteração foi aplicada. Revise o arquivo novamente");
        }
        if (!actionable.has(decision.status) || !song && decision.status !== "CREATE") continue;

        const scalars = selectedScalars(incoming, options.fields, decision.status === "CREATE");
        if (!song) {
          song = await tx.song.create({
            data: {
              tenantId,
              title,
              normalizedTitle,
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
            select: songSelect,
          }) as ExistingSong;
          counts.created += 1;
        } else if (decision.status === "UPDATE") {
          const inactive = !song.isActive || Boolean(song.deletedAt);
          await tx.song.update({
            where: { id: song.id },
            data: {
              ...scalars,
              ...(inactive ? { isActive: true, deletedAt: null } : {}),
              updatedById: this.user.id,
            },
          });
          counts.updated += 1;
          if (inactive) counts.restored += 1;
        } else if (!song.isActive || song.deletedAt) {
          song = await tx.song.update({
            where: { id: song.id },
            data: { isActive: true, deletedAt: null, updatedById: this.user.id },
            select: songSelect,
          }) as ExistingSong;
          counts.restored += 1;
        }

        const shouldImportTags = decision.status === "CREATE"
          ? Boolean(incoming.tags?.length)
          : decision.status === "UPDATE" && provided(incoming, "tags");
        if (options.fields.has("tags") && shouldImportTags) {
          await replaceSongTags(tx, tenantId, song.id, prepareSongTags(incoming.tags ?? []));
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
    }, { timeout: 120_000 });

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
