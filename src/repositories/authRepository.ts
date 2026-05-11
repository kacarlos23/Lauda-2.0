import { Prisma, User } from "@prisma/client";
import { prisma } from "./prismaClient";

export type AuthUser = Pick<User, "id" | "name" | "email" | "password" | "role" | "tenantId">;

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
        password: true,
        role: true,
        tenantId: true,
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
        password: true,
        role: true,
        tenantId: true,
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
      },
    });
  }

  async findCurrentMemberInvite(tenantId: string) {
    return prisma.memberInvite.findFirst({
      where: { tenantId, active: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        active: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }

  async createMemberInvite(tenantId: string, code: string) {
    return prisma.memberInvite.create({
      data: { tenantId, code },
      select: {
        id: true,
        code: true,
        active: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }

  async deactivateMemberInvites(tenantId: string) {
    return prisma.memberInvite.updateMany({
      where: { tenantId, active: true },
      data: { active: false },
    });
  }

  async createPublicMember(data: {
    tenantId: string;
    name: string;
    email: string;
    phone?: string;
    hashedPassword: string;
  }): Promise<AuthUser> {
    return prisma.user.create({
      data: {
        tenantId: data.tenantId,
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        password: data.hashedPassword,
        role: "MEMBER",
      },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: true,
        tenantId: true,
      },
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
