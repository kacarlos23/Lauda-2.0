import { prisma } from "./prismaClient";
import { CreateMemberInput } from "../validators/member.schema";

export class MemberRepository {
  constructor(private readonly tenantId: string) {}

  findAll() {
    return prisma.user.findMany({
      where: { tenantId: this.tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        ministries: {
          include: {
            ministry: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  findById(id: string) {
    return prisma.user.findFirst({
      where: { id, tenantId: this.tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        ministries: {
          include: {
            ministry: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  findMinistryById(ministryId: string) {
    return prisma.ministry.findFirst({
      where: { id: ministryId, tenantId: this.tenantId },
      select: { id: true },
    });
  }

  create(data: CreateMemberInput & { password: string }) {
    const { name, email, phone, role, password } = data;
    return prisma.user.create({
      data: {
        name,
        email,
        phone: phone ?? null,
        role,
        password,
        tenantId: this.tenantId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });
  }

  addMinistry(userId: string, ministryId: string, isLeader: boolean) {
    return prisma.ministryMember.upsert({
      where: { userId_ministryId: { userId, ministryId } },
      update: { isLeader, tenantId: this.tenantId },
      create: { userId, ministryId, isLeader, tenantId: this.tenantId, status: "ACTIVE" },
      include: {
        ministry: { select: { id: true, name: true } },
      },
    });
  }
}
