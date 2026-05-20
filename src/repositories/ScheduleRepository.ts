import { prisma } from "./prismaClient";
import { CreateScheduleInput } from "../validators/schedule.schema";

export type CreateScheduleAssignmentData = {
  scheduleId: string;
  userId: string;
  role: string;
};

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

  findUserById(userId: string) {
    return prisma.user.findFirst({
      where: { id: userId, tenantId: this.tenantId },
      select: { id: true },
    });
  }

  isUserLeaderOfMinistry(userId: string, ministryId: string) {
    return prisma.ministryMember
      .findFirst({
        where: {
          userId,
          ministryId,
          tenantId: this.tenantId,
          isLeader: true,
        },
        select: { id: true },
      })
      .then(Boolean);
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

  createAssignment(data: CreateScheduleAssignmentData) {
    return prisma.scheduleAssignment.create({
      data: {
        scheduleId: data.scheduleId,
        userId: data.userId,
        role: data.role,
        tenantId: this.tenantId,
        status: "PENDING",
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  findAssignmentById(scheduleId: string, assignmentId: string) {
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
            ministryId: true,
            tenantId: true,
          },
        },
      },
    });
  }

  updateAssignmentStatus(assignmentId: string, status: "PENDING" | "ACCEPTED" | "DECLINED") {
    return prisma.scheduleAssignment.updateMany({
      where: { id: assignmentId, tenantId: this.tenantId },
      data: { status },
    });
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
