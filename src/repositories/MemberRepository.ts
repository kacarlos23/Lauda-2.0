import { prisma } from "./prismaClient";
import { CreateMemberInput } from "../validators/member.schema";

const userInstrumentInclude = {
  include: {
    instrument: { select: { id: true, name: true, colorHex: true } },
  },
};

function mapMemberInstruments<T extends { instruments?: Array<{ instrument: { id: string; name: string; colorHex: string | null } }> }>(
  member: T
) {
  const { instruments = [], ...rest } = member;
  return {
    ...rest,
    instruments: instruments.map((item) => item.instrument),
  };
}

export class MemberRepository {
  constructor(private readonly tenantId: string) {}

  async findAll() {
    const members = await prisma.user.findMany({
      where: { tenantId: this.tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        tenantId: true,
        createdAt: true,
        ministries: {
          include: {
            ministry: { select: { id: true, name: true } },
          },
        },
        instruments: userInstrumentInclude,
      },
      orderBy: { name: "asc" },
    });

    return members.map(mapMemberInstruments);
  }

  async findById(id: string) {
    const member = await prisma.user.findFirst({
      where: { id, tenantId: this.tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true,
        ministries: {
          include: {
            ministry: { select: { id: true, name: true } },
          },
        },
        instruments: userInstrumentInclude,
      },
    });

    return member ? mapMemberInstruments(member) : null;
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
        tenantId: true,
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

  async findInstrumentIds(ids: string[]) {
    return prisma.instrument.findMany({
      where: { id: { in: ids }, tenantId: this.tenantId },
      select: { id: true },
    });
  }

  async replaceInstruments(userId: string, instrumentIds: string[]) {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.userInstrument.deleteMany({
        where: { userId, tenantId: this.tenantId },
      });

      if (instrumentIds.length > 0) {
        await tx.userInstrument.createMany({
          data: instrumentIds.map((instrumentId) => ({
            userId,
            instrumentId,
            tenantId: this.tenantId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.userInstrument.findMany({
        where: { userId, tenantId: this.tenantId },
        include: {
          instrument: { select: { id: true, name: true, colorHex: true } },
        },
        orderBy: { instrument: { name: "asc" } },
      });
    });

    return rows.map((row) => row.instrument);
  }
}
