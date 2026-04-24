import { prisma } from "./prismaClient";

export abstract class BaseRepository<T> {
  // A BaseRepository can optionally enforce the tenantId pattern
  // Or provide common helper methods to interact with Prisma.
  // In a multi-tenant application, every repository must filter by tenantId.

  constructor(protected readonly tenantId: string) {}

  // Example: Subclasses must use `this.tenantId` in their WHERE clauses.
  // prisma.ministry.findMany({ where: { tenantId: this.tenantId } });
}
