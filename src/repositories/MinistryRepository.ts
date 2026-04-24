import { prisma } from "./prismaClient";
import { CreateMinistryInput, UpdateMinistryInput } from "../validators/ministry.schema";

export class MinistryRepository {
  constructor(private readonly tenantId: string) {}

  findAll() {
    return prisma.ministry.findMany({
      where: { tenantId: this.tenantId },
      include: { _count: { select: { members: true } } },
      orderBy: { name: "asc" },
    });
  }

  findById(id: string) {
    return prisma.ministry.findFirst({
      where: { id, tenantId: this.tenantId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
      },
    });
  }

  create(data: CreateMinistryInput) {
    return prisma.ministry.create({
      data: { ...data, tenantId: this.tenantId },
    });
  }

  update(id: string, data: UpdateMinistryInput) {
    return prisma.ministry.updateMany({
      where: { id, tenantId: this.tenantId },
      data,
    });
  }

  delete(id: string) {
    return prisma.ministry.deleteMany({
      where: { id, tenantId: this.tenantId },
    });
  }
}
