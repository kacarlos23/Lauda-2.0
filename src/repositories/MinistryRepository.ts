import { prisma } from "./prismaClient";
import { CreateMinistryInput, UpdateMinistryInput } from "../validators/ministry.schema";
import { AssignMemberToMinistryInput, ListMinistryMembersInput, UpdateMemberAssignmentInput } from "../validators/member.schema";
import { Prisma, Role } from "@prisma/client";

const ministryMemberUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
} satisfies Prisma.UserSelect;

const ministryMemberInclude = {
  user: { select: ministryMemberUserSelect },
  ministry: { select: { id: true, name: true, tenantId: true } },
};

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

  findUserById(userId: string) {
    return prisma.user.findFirst({
      where: { id: userId, tenantId: this.tenantId },
      select: { id: true, name: true, email: true, role: true, tenantId: true },
    });
  }

  findAssignmentById(assignmentId: string) {
    return prisma.ministryMember.findFirst({
      where: { id: assignmentId, tenantId: this.tenantId },
      include: ministryMemberInclude,
    });
  }

  findAssignmentByUserAndMinistry(userId: string, ministryId: string) {
    return prisma.ministryMember.findUnique({
      where: { userId_ministryId: { userId, ministryId } },
      include: ministryMemberInclude,
    });
  }

  createMembership(ministryId: string, userId: string) {
    return prisma.ministryMember.create({
      data: {
        userId,
        ministryId,
        tenantId: this.tenantId,
        isLeader: false,
      },
      include: ministryMemberInclude,
    });
  }

  assignMemberToMinistry(data: AssignMemberToMinistryInput) {
    const { userId, ministryId, roleId, role, skills, status, notes, isLeader } = data;

    return prisma.ministryMember.create({
      data: {
        userId,
        ministryId,
        tenantId: this.tenantId,
        roleId: roleId ?? null,
        role: role ?? null,
        skills,
        status,
        notes: notes ?? null,
        isLeader,
      },
      include: ministryMemberInclude,
    });
  }

  updateMemberAssignment(assignmentId: string, data: Omit<UpdateMemberAssignmentInput, "assignmentId">) {
    const { roleId, role, skills, status, notes, isLeader } = data;

    return prisma.ministryMember.update({
      where: { id: assignmentId },
      data: {
        ...(roleId !== undefined ? { roleId } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(skills !== undefined ? { skills } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(isLeader !== undefined ? { isLeader } : {}),
      },
      include: ministryMemberInclude,
    });
  }

  async getMinistryMembers(ministryId: string, filters: ListMinistryMembersInput) {
    const search = filters.search?.trim();
    const where: Prisma.MinistryMemberWhereInput = {
      ministryId,
      tenantId: this.tenantId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(search
        ? {
            user: {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };

    const skip = (filters.page - 1) * filters.limit;
    const [items, total] = await prisma.$transaction([
      prisma.ministryMember.findMany({
        where,
        include: ministryMemberInclude,
        orderBy: [{ status: "asc" }, { user: { name: "asc" } }],
        skip,
        take: filters.limit,
      }),
      prisma.ministryMember.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  getMemberAssignments(userId: string, tenantId: string) {
    return prisma.ministryMember.findMany({
      where: { userId, tenantId },
      include: ministryMemberInclude,
      orderBy: [{ ministry: { name: "asc" } }],
    });
  }

  removeMemberFromMinistry(assignmentId: string) {
    return prisma.ministryMember.deleteMany({
      where: { id: assignmentId, tenantId: this.tenantId },
    });
  }
}
