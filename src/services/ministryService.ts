import { MinistryRepository } from "../repositories/MinistryRepository";
import { CreateMinistryInput, UpdateMinistryInput } from "../validators/ministry.schema";

export class MinistryService {
  constructor(private readonly ministryRepository: MinistryRepository) {}

  async listAll() {
    return this.ministryRepository.findAll();
  }

  async getById(id: string) {
    const ministry = await this.ministryRepository.findById(id);
    if (!ministry) {
      throw new Error("Ministério não encontrado");
    }
    return ministry;
  }

  async create(data: CreateMinistryInput) {
    return this.ministryRepository.create(data);
  }

  async update(id: string, data: UpdateMinistryInput) {
    await this.getById(id); // validates ownership + existence
    const result = await this.ministryRepository.update(id, data);
    if (result.count === 0) {
      throw new Error("Ministério não encontrado");
    }
    return this.ministryRepository.findById(id);
  }

  async delete(id: string) {
    await this.getById(id); // validates ownership + existence
    const result = await this.ministryRepository.delete(id);
    if (result.count === 0) {
      throw new Error("Ministério não encontrado");
    }
  }
}
