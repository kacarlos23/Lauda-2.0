import { prisma } from "./prismaClient";
import { CreateScheduleInput } from "../validators/schedule.schema";

export class ScheduleRepository {
  constructor(private readonly tenantId: string) {}

  /**
   * Lists schedules for the authenticated tenant.
   *
   * @returns Schedules visible to the current tenant only.
   */
  findAll() {
    return prisma.schedule.findMany({
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
      where: { id: ministryId },
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
}
