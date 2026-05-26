import { prisma } from "./prismaClient";
import { CreateAssignmentInput, CreateScheduleInput, UpdateAssignmentStatusInput } from "../validators/schedule.schema";

export class ScheduleRepository {
  constructor(private readonly tenantId: string) {}

  /**
   * Lists schedules for the authenticated tenant.
   *
   * @returns Schedules visible to the current tenant only.
   */
  findAll() {
    return prisma.schedule.findMany({
      where: { tenantId: this.tenantId },
      include: {
        ministry: { select: { id: true, name: true } },
        assignments: true,
      },
      orderBy: { date: "asc" },
    });
  }

  /**
   * Finds a ministry within the authenticated tenant.
   *
   * @param ministryId Ministry identifier to validate.
   * @returns The ministry id when it belongs to the tenant, otherwise null.
   */
  findMinistryById(ministryId: string) {
    return prisma.ministry.findFirst({
      where: { id: ministryId, tenantId: this.tenantId },
      select: { id: true },
    });
  }

  findScheduleById(scheduleId: string) {
    return prisma.schedule.findFirst({
      where: { id: scheduleId, tenantId: this.tenantId },
      include: {
        ministry: { select: { id: true, name: true } },
      },
    });
  }

  findTenantUserById(userId: string) {
    return prisma.user.findFirst({
      where: { id: userId, tenantId: this.tenantId },
      select: { id: true, name: true, email: true, tenantId: true },
    });
  }

  findMinistryLeadership(ministryId: string, userId: string) {
    return prisma.ministryMember.findFirst({
      where: {
        ministryId,
        userId,
        tenantId: this.tenantId,
        isLeader: true,
      },
      select: { id: true },
    });
  }

  /**
   * Creates a schedule owned by the authenticated tenant.
   *
   * @param data Validated schedule input without tenantId.
   * @returns The created schedule.
   */
  create(data: CreateScheduleInput) {
    return prisma.schedule.create({
      data: {
        title: data.title,
        date: data.date,
        ministryId: data.ministryId,
        tenantId: this.tenantId,
      },
    });
  }

  createAssignment(scheduleId: string, data: CreateAssignmentInput) {
    return prisma.$transaction(async (tx) => {
      const [schedule, user] = await Promise.all([
        tx.schedule.findFirst({ where: { id: scheduleId, tenantId: this.tenantId }, select: { id: true } }),
        tx.user.findFirst({ where: { id: data.userId, tenantId: this.tenantId }, select: { id: true } }),
      ]);

      if (!schedule || !user) {
        return null;
      }

      return tx.scheduleAssignment.create({
        data: {
          scheduleId,
          userId: data.userId,
          role: data.role,
          status: data.status,
          tenantId: this.tenantId,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          schedule: {
            select: {
              id: true,
              title: true,
              date: true,
              ministry: { select: { id: true, name: true } },
            },
          },
        },
      });
    });
  }

  findAssignment(scheduleId: string, assignmentId: string) {
    return prisma.scheduleAssignment.findFirst({
      where: {
        id: assignmentId,
        scheduleId,
        tenantId: this.tenantId,
        schedule: { tenantId: this.tenantId },
      },
      include: {
        schedule: {
          select: {
            id: true,
            title: true,
            date: true,
            ministryId: true,
            ministry: { select: { id: true, name: true } },
          },
        },
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async updateAssignmentStatus(scheduleId: string, assignmentId: string, data: UpdateAssignmentStatusInput) {
    const result = await prisma.scheduleAssignment.updateMany({
      where: {
        id: assignmentId,
        scheduleId,
        tenantId: this.tenantId,
        schedule: { tenantId: this.tenantId },
      },
      data: { status: data.status },
    });

    if (result.count === 0) {
      return null;
    }

    return this.findAssignment(scheduleId, assignmentId);
  }

  deleteAssignment(assignmentId: string) {
    return prisma.scheduleAssignment.deleteMany({
      where: { id: assignmentId, tenantId: this.tenantId },
    });
  }

  findSchedulesForUser(userId: string) {
    return prisma.scheduleAssignment.findMany({
      where: {
        userId,
        tenantId: this.tenantId,
        schedule: { tenantId: this.tenantId },
      },
      include: {
        schedule: {
          include: {
            ministry: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { schedule: { date: "asc" } },
    });
  }
}
