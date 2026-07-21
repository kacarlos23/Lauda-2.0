import { Prisma } from "@prisma/client";
import { ConflictError, NotFoundError } from "../errors/AppError";
import { ArtistRepository } from "../repositories/artistRepository";
import { SongRepository } from "../repositories/songRepository";
import { cleanCatalogText, normalizeCatalogText } from "../utils/catalogNormalization";
import { CreateSongInput, SongListInput, UpdateSongInput } from "../validators/song.schema";

export class SongService {
  constructor(
    private readonly repository: SongRepository,
    private readonly artistRepository: ArtistRepository,
    private readonly userId: string
  ) {}

  async list(input: SongListInput) {
    const result = await this.repository.list(input, normalizeCatalogText(input.search));
    return {
      items: result.items,
      pagination: {
        page: input.page,
        limit: input.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / input.limit),
      },
    };
  }

  async get(id: string) {
    const song = await this.repository.findById(id);
    if (!song) throw new NotFoundError("Música não encontrada");
    return song;
  }

  async create(input: CreateSongInput) {
    await this.requireArtist(input.artistId);
    const title = cleanCatalogText(input.title);
    try {
      return await this.repository.create({
        title,
        normalizedTitle: normalizeCatalogText(title),
        artistId: input.artistId,
        composer: input.composer ? cleanCatalogText(input.composer) : null,
        originalKey: input.originalKey,
        content: input.content,
        comments: input.comments ?? null,
        bpm: input.bpm ?? null,
        cifraUrl: input.cifraUrl ?? null,
        letraUrl: input.letraUrl ?? null,
        audioUrl: input.audioUrl ?? null,
        videoUrl: input.videoUrl ?? null,
        userId: this.userId,
      });
    } catch (error) {
      this.handleConflict(error);
    }
  }

  async update(id: string, input: UpdateSongInput) {
    await this.get(id);
    if (input.artistId) await this.requireArtist(input.artistId);
    const title = input.title === undefined ? undefined : cleanCatalogText(input.title);
    try {
      const song = await this.repository.update(id, {
        ...(title !== undefined ? { title, normalizedTitle: normalizeCatalogText(title) } : {}),
        ...(input.artistId !== undefined ? { artistId: input.artistId } : {}),
        ...(input.composer !== undefined ? { composer: input.composer ? cleanCatalogText(input.composer) : null } : {}),
        ...(input.originalKey !== undefined ? { originalKey: input.originalKey } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.comments !== undefined ? { comments: input.comments } : {}),
        ...(input.bpm !== undefined ? { bpm: input.bpm } : {}),
        ...(input.cifraUrl !== undefined ? { cifraUrl: input.cifraUrl } : {}),
        ...(input.letraUrl !== undefined ? { letraUrl: input.letraUrl } : {}),
        ...(input.audioUrl !== undefined ? { audioUrl: input.audioUrl } : {}),
        ...(input.videoUrl !== undefined ? { videoUrl: input.videoUrl } : {}),
        updatedById: this.userId,
      });
      if (!song) throw new NotFoundError("Música não encontrada");
      return song;
    } catch (error) {
      this.handleConflict(error);
    }
  }

  async delete(id: string) {
    await this.get(id);
    const count = await this.repository.delete(id);
    if (!count) throw new NotFoundError("Música não encontrada");
    return { id, isActive: false, message: "Música removida com sucesso" };
  }

  async getForExport(ids: string[]) {
    const songs = await this.repository.findByIds(ids);
    if (songs.length !== ids.length) throw new NotFoundError("Uma ou mais músicas não foram encontradas");
    const byId = new Map(songs.map((song) => [song.id, song]));
    return ids.map((id) => byId.get(id)!);
  }

  private async requireArtist(id: string) {
    if (!await this.artistRepository.findById(id)) throw new NotFoundError("Artista não encontrado");
  }

  private handleConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("Já existe uma música com este título para o artista selecionado");
    }
    throw error;
  }
}
