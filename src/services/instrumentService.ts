import { Prisma } from "@prisma/client";
import { AppError, NotFoundError, ValidationError } from "../errors/AppError";
import { InstrumentRepository } from "../repositories/InstrumentRepository";
import { CreateInstrumentInput, UpdateInstrumentInput } from "../validators/instrument.schema";

export class InstrumentService {
  constructor(private readonly instrumentRepository: InstrumentRepository) {}

  listAll() {
    return this.instrumentRepository.findAll();
  }

  async create(input: CreateInstrumentInput) {
    try {
      return await this.instrumentRepository.create(input);
    } catch (error) {
      this.handleKnownError(error);
    }
  }

  async update(id: string, input: UpdateInstrumentInput) {
    const instrument = await this.instrumentRepository.findById(id);
    if (!instrument) {
      throw new NotFoundError("Instrumento não encontrado");
    }

    try {
      const updated = await this.instrumentRepository.update(id, input);
      if (!updated) {
        throw new NotFoundError("Instrumento não encontrado");
      }
      return updated;
    } catch (error) {
      this.handleKnownError(error);
    }
  }

  async delete(id: string) {
    const instrument = await this.instrumentRepository.findById(id);
    if (!instrument) {
      throw new NotFoundError("Instrumento não encontrado");
    }

    const deleted = await this.instrumentRepository.delete(id);
    if (!deleted) {
      throw new NotFoundError("Instrumento não encontrado");
    }
    return deleted;
  }

  private handleKnownError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ValidationError("Já existe um instrumento com este nome");
    }

    if (error instanceof AppError) throw error;
    throw error;
  }
}
