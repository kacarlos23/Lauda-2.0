import { Prisma } from "@prisma/client";
import { basePrisma } from "../config/prisma";

const tenantSelect = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TenantSelect;

const memberSelect = {
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
  instruments: {
    include: {
      instrument: { select: { id: true, name: true, colorHex: true } },
    },
  },
} satisfies Prisma.UserSelect;

function mapMemberInstruments<
  T extends { instruments?: Array<{ instrument: { id: string; name: string; colorHex: string | null } }> },
>(member: T) {
  const { instruments = [], ...rest } = member;
  return {
    ...rest,
    instruments: instruments.map((item) => item.instrument),
  };
}

export class ChurchRepository {
  constructor(private readonly tenantId: string) {}

  async getSummary() {
    return basePrisma.tenant.findFirst({
      where: { id: this.tenantId },
      select: {
        ...tenantSelect,
        _count: {
          select: {
            users: true,
            ministries: true,
            schedules: true,
            instruments: true,
          },
        },
      },
    });
  }

  async update(data: { name: string }) {
    const result = await basePrisma.tenant.updateMany({
      where: { id: this.tenantId },
      data: { name: data.name },
    });

    if (result.count === 0) {
      return null;
    }

    return this.getSummary();
  }

  async getOverview() {
    const tenant = await basePrisma.tenant.findFirst({
      where: { id: this.tenantId },
      select: tenantSelect,
    });

    if (!tenant) {
      return null;
    }

    const [members, ministries, instruments, schedules] = await basePrisma.$transaction([
      basePrisma.user.findMany({
        where: { tenantId: this.tenantId },
        select: memberSelect,
        orderBy: { name: "asc" },
      }),
      basePrisma.ministry.findMany({
        where: { tenantId: this.tenantId },
        select: {
          id: true,
          name: true,
          description: true,
          tenantId: true,
          createdAt: true,
          _count: { select: { members: true } },
        },
        orderBy: { name: "asc" },
      }),
      basePrisma.instrument.findMany({
        where: { tenantId: this.tenantId },
        select: { id: true, name: true, colorHex: true },
        orderBy: { name: "asc" },
      }),
      basePrisma.schedule.findMany({
        where: { tenantId: this.tenantId },
        select: {
          id: true,
          title: true,
          date: true,
          ministryId: true,
          tenantId: true,
          ministry: { select: { id: true, name: true } },
        },
        orderBy: { date: "asc" },
      }),
    ]);

    return {
      tenant,
      members: members.map(mapMemberInstruments),
      ministries,
      instruments,
      schedules,
    };
  }
}
