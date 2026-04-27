import { ScheduleRepository } from "../repositories/ScheduleRepository";
import { CreateScheduleInput } from "../validators/schedule.schema";

export class ScheduleService {
  constructor(private readonly scheduleRepository: ScheduleRepository) {}

  async create(data: CreateScheduleInput) {
    const ministry = await this.scheduleRepository.findMinistryById(data.ministryId);
    if (!ministry) {
      throw new Error("Ministerio nao encontrado");
    }

    return this.scheduleRepository.create(data);
  }
}
