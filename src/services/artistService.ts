import { Prisma } from "@prisma/client";
import { ConflictError, NotFoundError } from "../errors/AppError";
import { ArtistRepository } from "../repositories/artistRepository";
import { ArtistListInput, CreateArtistInput, UpdateArtistInput } from "../validators/artist.schema";
import { cleanCatalogText, normalizeCatalogText } from "../utils/catalogNormalization";

export class ArtistService {
  constructor(private readonly repository: ArtistRepository) {}

  async list(input: ArtistListInput) {
    const search = normalizeCatalogText(input.search);
    const matches = await this.repository.findMatching(search);
    const ranked = matches.sort((a, b) => {
      const rank = (value: string) => value === search ? 0 : value.startsWith(search) ? 1 : 2;
      return rank(a.normalizedName) - rank(b.normalizedName) || a.name.localeCompare(b.name, "pt-BR");
    });
    const start = (input.page - 1) * input.limit;
    return {
      items: ranked.slice(start, start + input.limit).map(({ normalizedName: _normalizedName, ...artist }) => artist),
      pagination: {
        page: input.page,
        limit: input.limit,
        total: ranked.length,
        totalPages: Math.ceil(ranked.length / input.limit),
      },
    };
  }

  async get(id: string) {
    const artist = await this.repository.findById(id);
    if (!artist) throw new NotFoundError("Artista não encontrado");
    return artist;
  }

  async create(input: CreateArtistInput) {
    const name = cleanCatalogText(input.name);
    try {
      return await this.repository.create(name, normalizeCatalogText(name), input.imageUrl ?? null);
    } catch (error) {
      this.handleConflict(error);
    }
  }

  async update(id: string, input: UpdateArtistInput) {
    await this.get(id);
    const name = input.name === undefined ? undefined : cleanCatalogText(input.name);
    try {
      const artist = await this.repository.update(id, {
        ...(name !== undefined ? { name, normalizedName: normalizeCatalogText(name) } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      });
      if (!artist) throw new NotFoundError("Artista não encontrado");
      return artist;
    } catch (error) {
      this.handleConflict(error);
    }
  }

  private handleConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("Já existe um artista com este nome");
    }
    throw error;
  }
}
