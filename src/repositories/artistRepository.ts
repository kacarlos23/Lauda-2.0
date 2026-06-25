import { Prisma } from "@prisma/client";
import { prisma } from "./prismaClient";

export const artistSelect = {
  id: true,
  name: true,
  imageUrl: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ArtistSelect;

export class ArtistRepository {
  constructor(private readonly tenantId: string) {}

  findMatching(normalizedSearch: string) {
    return prisma.artist.findMany({
      where: {
        tenantId: this.tenantId,
        ...(normalizedSearch ? { normalizedName: { contains: normalizedSearch } } : {}),
      },
      select: { ...artistSelect, normalizedName: true },
      orderBy: { name: "asc" },
      take: 1000,
    });
  }

  findById(id: string) {
    return prisma.artist.findFirst({ where: { id, tenantId: this.tenantId }, select: artistSelect });
  }

  create(name: string, normalizedName: string, imageUrl: string | null) {
    return prisma.artist.create({
      data: { name, normalizedName, imageUrl, tenantId: this.tenantId },
      select: artistSelect,
    });
  }

  async update(id: string, data: { name?: string; normalizedName?: string; imageUrl?: string | null }) {
    const result = await prisma.artist.updateMany({ where: { id, tenantId: this.tenantId }, data });
    return result.count ? this.findById(id) : null;
  }
}
