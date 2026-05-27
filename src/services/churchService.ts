import { NotFoundError } from "../errors/AppError";
import { ChurchRepository } from "../repositories/ChurchRepository";
import { UpdateChurchInput } from "../validators/church.schema";

export class ChurchService {
  constructor(private readonly repository: ChurchRepository) {}

  private formatSummary(summary: NonNullable<Awaited<ReturnType<ChurchRepository["getSummary"]>>>) {
    const { _count, ...tenant } = summary;
    return { tenant, _count };
  }

  async getSummary() {
    const summary = await this.repository.getSummary();
    if (!summary) {
      throw new NotFoundError("Igreja não encontrada");
    }
    return this.formatSummary(summary);
  }

  async update(data: UpdateChurchInput) {
    const summary = await this.repository.update(data);
    if (!summary) {
      throw new NotFoundError("Igreja não encontrada");
    }
    return this.formatSummary(summary);
  }

  async getOverview() {
    const overview = await this.repository.getOverview();
    if (!overview) {
      throw new NotFoundError("Igreja não encontrada");
    }
    return overview;
  }
}
