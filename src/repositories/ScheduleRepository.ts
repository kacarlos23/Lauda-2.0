import { prisma } from "./prismaClient";
import { CreateScheduleInput } from "../validators/schedule.schema";

export class ScheduleRepository {
  constructor(private readonly tenantId: string) {}

  findMinistryById(ministryId: string) {
    return prisma.ministry.findFirst({
      where: { id: ministryId, tenantId: this.tenantId },
      select: { id: true },
    });
  }

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
