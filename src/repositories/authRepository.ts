import { Prisma, User } from "@prisma/client";
import { DEFAULT_INSTRUMENTS } from "../constants/defaultInstruments";
import { prisma } from "./prismaClient";

export type AuthUser = Pick<User, "id" | "name" | "email" | "password" | "phone" | "avatarUrl" | "role" | "tenantId" | "isActive"> & {
  instruments?: Array<{ instrument: { id: string; name: string; colorHex: string | null } }>;
  tenant?: { id: string; name: string } | null;
};

export class AuthRepository {
  /**
   * Finds a user by e-mail for authentication.
   *
   * @param email User e-mail address.
   * @returns The matching user or null.
   */
  async findUserByEmail(email: string): Promise<AuthUser | null> {
    return prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        password: true,
        role: true,
        isActive: true,
        tenantId: true,
        tenant: { select: { id: true, name: true } },
        instruments: {
          include: {
            instrument: { select: { id: true, name: true, colorHex: true } },
          },
        },
      },
    });
  }

  /**
   * Finds a user by id for refresh-token validation.
   *
   * @param id User id from the refresh-token payload.
   * @returns The matching user or null.
   */
  async findUserById(id: string): Promise<AuthUser | null> {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        password: true,
        role: true,
        isActive: true,
        tenantId: true,
        tenant: { select: { id: true, name: true } },
        instruments: {
          include: {
            instrument: { select: { id: true, name: true, colorHex: true } },
          },
        },
      },
    });
  }

  /**
   * Creates a tenant and its first administrator in a single Prisma write.
   *
   * @param data Tenant registration data.
   * @returns Tenant with created administrator.
   */
  async createTenantWithAdmin(data: {
    churchName: string;
    name: string;
    email: string;
    hashedPassword: string;
  }): Promise<Prisma.TenantGetPayload<{ include: { users: true } }>> {
    return prisma.tenant.create({
      data: {
        name: data.churchName,
        users: {
          create: {
            name: data.name,
            email: data.email,
            password: data.hashedPassword,
            role: "TENANT_ADMIN",
          },
        },
        instruments: {
          create: DEFAULT_INSTRUMENTS.map((instrument) => ({
            name: instrument.name,
            colorHex: instrument.colorHex,
          })),
        },
      },
      include: { users: true },
    });
  }

  async findActiveMemberInviteByCode(code: string) {
    return prisma.memberInvite.findFirst({
      where: {
        code,
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        tenant: { select: { id: true, name: true } },
        ministry: { select: { id: true, name: true } },
      },
    });
  }

  async findCurrentMemberInvite(tenantId: string, ministryId?: string) {
    return prisma.memberInvite.findFirst({
      where: {
        tenantId,
        ministryId: ministryId ?? null,
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        active: true,
        expiresAt: true,
        createdAt: true,
        ministryId: true,
        ministry: { select: { id: true, name: true } },
      },
    });
  }

  async createMemberInvite(tenantId: string, code: string, ministryId?: string) {
    return prisma.memberInvite.create({
      data: { tenantId, code, ministryId: ministryId ?? null },
      select: {
        id: true,
        code: true,
        active: true,
        expiresAt: true,
        createdAt: true,
        ministryId: true,
        ministry: { select: { id: true, name: true } },
      },
    });
  }

  async deactivateMemberInvites(tenantId: string, ministryId?: string) {
    return prisma.memberInvite.updateMany({
      where: { tenantId, ministryId: ministryId ?? null, active: true },
      data: { active: false },
    });
  }

  async findMinistryById(tenantId: string, ministryId: string) {
    return prisma.ministry.findFirst({
      where: { id: ministryId, tenantId },
      select: { id: true, name: true },
    });
  }

  async createPublicMember(data: {
    tenantId: string;
    name: string;
    email: string;
    phone?: string;
    hashedPassword: string;
    ministryId?: string | null;
  }): Promise<AuthUser> {
    return prisma.$transaction(async (tx) => {
      if (data.ministryId) {
        const ministry = await tx.ministry.findFirst({
          where: { id: data.ministryId, tenantId: data.tenantId },
          select: { id: true },
        });

        if (!ministry) {
          throw new Error("Ministry not found in tenant");
        }
      }

      return tx.user.create({
        data: {
          tenantId: data.tenantId,
          name: data.name,
          email: data.email,
          phone: data.phone ?? null,
          password: data.hashedPassword,
          role: "MEMBER",
          ministries: data.ministryId
            ? {
                create: {
                  tenantId: data.tenantId,
                  ministryId: data.ministryId,
                  isLeader: false,
                },
              }
            : undefined,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatarUrl: true,
          password: true,
          role: true,
          isActive: true,
          tenantId: true,
          instruments: {
            include: {
              instrument: { select: { id: true, name: true, colorHex: true } },
            },
          },
        },
      });
    });
  }

  async addUserToMinistry(data: { tenantId: string; userId: string; ministryId: string }) {
    return prisma.$transaction(async (tx) => {
      const [user, ministry] = await Promise.all([
        tx.user.findFirst({ where: { id: data.userId, tenantId: data.tenantId }, select: { id: true } }),
        tx.ministry.findFirst({ where: { id: data.ministryId, tenantId: data.tenantId }, select: { id: true } }),
      ]);

      if (!user || !ministry) {
        return null;
      }

      return tx.ministryMember.upsert({
        where: { userId_ministryId: { userId: data.userId, ministryId: data.ministryId } },
        update: {},
        create: {
          tenantId: data.tenantId,
          userId: data.userId,
          ministryId: data.ministryId,
          isLeader: false,
        },
      });
    });
  }

  /**
   * Saves a password reset token for a user.
   */
  async savePasswordResetToken(userId: string, token: string, expiresAt: Date) {
    return prisma.user.update({
      where: { id: userId },
      data: { resetPasswordToken: token, resetPasswordExpires: expiresAt },
    });
  }

  /**
   * Finds a user by their reset token.
   */
  async findUserByResetToken(token: string) {
    return prisma.user.findUnique({
      where: { resetPasswordToken: token },
    });
  }

  /**
   * Updates the user's password and clears the reset token fields.
   */
  async updatePassword(userId: string, hashedPassword: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });
  }
}
