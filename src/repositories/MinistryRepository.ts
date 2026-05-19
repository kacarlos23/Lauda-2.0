import { prisma } from "./prismaClient";
import { CreateMinistryInput, UpdateMinistryInput } from "../validators/ministry.schema";
import { Role } from "@prisma/client";

export class MinistryRepository {
  constructor(private readonly tenantId: string) {}

  findAll(user?: { id: string; role: string }) {
    const canSeeAll = user?.role === Role.TENANT_ADMIN || user?.role === Role.GLOBAL_ADMIN;
    const where =
      user && !canSeeAll
        ? { tenantId: this.tenantId, members: { some: { userId: user.id } } }
        : { tenantId: this.tenantId };

    return prisma.ministry.findMany({
      where,
      include: { _count: { select: { members: true } } },
      orderBy: { name: "asc" },
    });
  }

  findById(id: string, user?: { id: string; role: string }) {
    const canSeeAll = user?.role === Role.TENANT_ADMIN || user?.role === Role.GLOBAL_ADMIN;
    const where =
      user && !canSeeAll
        ? { id, tenantId: this.tenantId, members: { some: { userId: user.id } } }
        : { id, tenantId: this.tenantId };

    return prisma.ministry.findFirst({
      where,
      include: {
        members: {
          orderBy: { user: { name: "asc" } },
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

  addMember(ministryId: string, userId: string, isLeader: boolean) {
    return prisma.ministryMember.upsert({
      where: { userId_ministryId: { userId, ministryId } },
      update: { isLeader, tenantId: this.tenantId },
      create: { userId, ministryId, isLeader, tenantId: this.tenantId },
    });
  }

  removeMember(ministryId: string, userId: string) {
    return prisma.ministryMember.deleteMany({
      where: { userId, ministryId, tenantId: this.tenantId },
    });
  }
}
