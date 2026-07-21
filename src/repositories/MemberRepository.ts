import { prisma } from "./prismaClient";
import { basePrisma } from "../config/prisma";
import { revokeUserSessionsInTransaction } from "../services/authSessionService";
import { Role } from "@prisma/client";
import { CreateMemberInput, UpdateMemberInput } from "../validators/member.schema";

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
      where: { tenantId: this.tenantId, isActive: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        comments: true,
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
      where: { id, tenantId: this.tenantId, isActive: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        comments: true,
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
    const { name, email, phone, role, password, comments } = data;
    return prisma.user.create({
      data: {
        name,
        email,
        phone: phone ?? null,
        role,
        comments: comments ?? null,
        password,
        tenantId: this.tenantId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        comments: true,
        role: true,
        tenantId: true,
        createdAt: true,
      },
    });
  }

  addMinistry(userId: string, ministryId: string, isLeader: boolean) {
    return prisma.$transaction(async (tx) => {
      const [user, ministry] = await Promise.all([
        tx.user.findFirst({ where: { id: userId, tenantId: this.tenantId }, select: { id: true } }),
        tx.ministry.findFirst({ where: { id: ministryId, tenantId: this.tenantId }, select: { id: true } }),
      ]);

      if (!user || !ministry) {
        return null;
      }

      return tx.ministryMember.upsert({
        where: { userId_ministryId: { userId, ministryId } },
        update: { isLeader, tenantId: this.tenantId },
        create: { userId, ministryId, isLeader, tenantId: this.tenantId, status: "ACTIVE" },
        include: {
          ministry: { select: { id: true, name: true } },
        },
      });
    });
  }

  findMinistryIds(ids: string[]) {
    return prisma.ministry.findMany({
      where: { id: { in: ids }, tenantId: this.tenantId },
      select: { id: true },
    });
  }

  async updateProfile(userId: string, data: { name?: string; phone?: string | null; avatarUrl?: string | null }) {
    const result = await prisma.user.updateMany({ where: { id: userId, tenantId: this.tenantId }, data });
    return result.count ? this.findById(userId) : null;
  }

  async updateMember(userId: string, data: UpdateMemberInput) {
    const result = await prisma.user.updateMany({
      where: { id: userId, tenantId: this.tenantId, isActive: true, deletedAt: null },
      data: { ...data, ...(data.email ? { email: data.email.toLowerCase() } : {}) },
    });
    return result.count ? this.findById(userId) : null;
  }

  async deactivateMember(userId: string) {
    return basePrisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: { id: userId, tenantId: this.tenantId, isActive: true, deletedAt: null },
        data: { isActive: false, deletedAt: new Date() },
      });
      if (result.count) await revokeUserSessionsInTransaction(tx, userId, "user_deactivated");
      return result.count;
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
      const user = await tx.user.findFirst({
        where: { id: userId, tenantId: this.tenantId },
        select: { id: true },
      });

      if (!user) {
        return null;
      }

      if (instrumentIds.length > 0) {
        const instruments = await tx.instrument.findMany({
          where: { id: { in: instrumentIds }, tenantId: this.tenantId },
          select: { id: true },
        });

        if (instruments.length !== instrumentIds.length) {
          return null;
        }
      }

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

    return rows ? rows.map((row) => row.instrument) : null;
  }

  async updatePermissions(
    userId: string,
    data: { role: Role; ministries: Array<{ ministryId: string; isLeader: boolean }> }
  ) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId, tenantId: this.tenantId },
        select: { id: true },
      });

      if (!user) {
        return null;
      }

      const ministryIds = data.ministries.map((item) => item.ministryId);
      if (ministryIds.length > 0) {
        const ministries = await tx.ministry.findMany({
          where: { id: { in: ministryIds }, tenantId: this.tenantId },
          select: { id: true },
        });

        if (ministries.length !== ministryIds.length) {
          return null;
        }
      }

      await tx.user.update({
        where: { id: userId },
        data: { role: data.role },
      });

      await tx.ministryMember.deleteMany({
        where: { userId, tenantId: this.tenantId, ministryId: { notIn: ministryIds } },
      });

      for (const ministry of data.ministries) {
        await tx.ministryMember.upsert({
          where: { userId_ministryId: { userId, ministryId: ministry.ministryId } },
          update: {
            isLeader: ministry.isLeader,
            status: "ACTIVE",
            tenantId: this.tenantId,
          },
          create: {
            userId,
            ministryId: ministry.ministryId,
            isLeader: ministry.isLeader,
            tenantId: this.tenantId,
            status: "ACTIVE",
          },
        });
      }

      return tx.user.findFirst({
        where: { id: userId, tenantId: this.tenantId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatarUrl: true,
          comments: true,
          role: true,
          tenantId: true,
          createdAt: true,
          updatedAt: true,
          ministries: {
            include: {
              ministry: { select: { id: true, name: true } },
            },
            orderBy: { ministry: { name: "asc" } },
          },
          instruments: userInstrumentInclude,
        },
      });
    }).then((member) => (member ? mapMemberInstruments(member) : null));
  }
}
