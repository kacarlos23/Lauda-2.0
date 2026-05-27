import { PrismaClient } from "@prisma/client";
import { basePrisma } from "../config/prisma";

const userPublicSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
  tenant: { select: { id: true, name: true } },
} as const;

export class AdminRepository {
  constructor(private readonly db: PrismaClient = basePrisma) {}

  listTenants() {
    return this.db.tenant.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
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

  getTenantById(tenantId: string) {
    return this.db.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        domain: true,
        createdAt: true,
        updatedAt: true,
        users: { select: userPublicSelect, orderBy: { name: "asc" } },
        ministries: {
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            description: true,
            tenantId: true,
            createdAt: true,
            _count: { select: { members: true, schedules: true } },
          },
        },
        instruments: {
          orderBy: { name: "asc" },
          select: { id: true, name: true, colorHex: true, tenantId: true, createdAt: true },
        },
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

  listUsers(tenantId?: string) {
    return this.db.user.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { createdAt: "desc" },
      select: userPublicSelect,
    });
  }

  listMinistries() {
    return this.db.ministry.findMany({
      orderBy: [{ tenant: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        tenantId: true,
        createdAt: true,
        tenant: { select: { id: true, name: true } },
        _count: { select: { members: true, schedules: true } },
      },
    });
  }
}
