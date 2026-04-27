import { ScheduleRepository } from "../repositories/ScheduleRepository";
import { CreateScheduleInput } from "../validators/schedule.schema";

export class ScheduleService {
  constructor(private readonly scheduleRepository: ScheduleRepository) {}

  /**
   * Lists schedules visible to the authenticated tenant.
   *
   * @returns Tenant-scoped schedules.
   */
  async listAll() {
    return this.scheduleRepository.findAll();
  }

  /**
   * Creates a schedule after validating ministry ownership.
   *
   * @param data Validated schedule input.
   * @returns The created schedule.
   */
  async create(data: CreateScheduleInput) {
    const ministry = await this.scheduleRepository.findMinistryById(data.ministryId);
    if (!ministry) {
      throw new Error("Ministerio nao encontrado");
    }

    return this.scheduleRepository.create(data);
  }
}
