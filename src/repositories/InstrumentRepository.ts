import { Prisma } from "@prisma/client";
import { prisma } from "./prismaClient";
import { CreateInstrumentInput, UpdateInstrumentInput } from "../validators/instrument.schema";

const instrumentSelect = {
  id: true,
  name: true,
  colorHex: true,
} satisfies Prisma.InstrumentSelect;

export class InstrumentRepository {
  constructor(private readonly tenantId: string) {}

  findAll() {
    return prisma.instrument.findMany({
      where: { tenantId: this.tenantId },
      select: instrumentSelect,
      orderBy: { name: "asc" },
    });
  }

  findById(id: string) {
    return prisma.instrument.findFirst({
      where: { id, tenantId: this.tenantId },
      select: instrumentSelect,
    });
  }

  create(data: CreateInstrumentInput) {
    return prisma.instrument.create({
      data: {
        name: data.name,
        colorHex: data.colorHex ?? null,
        tenantId: this.tenantId,
      },
      select: instrumentSelect,
    });
  }

  async update(id: string, data: UpdateInstrumentInput) {
    const result = await prisma.instrument.updateMany({
      where: { id, tenantId: this.tenantId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.colorHex !== undefined ? { colorHex: data.colorHex } : {}),
      },
    });

    if (result.count === 0) {
      return null;
    }

    return this.findById(id);
  }

  async delete(id: string) {
    const instrument = await this.findById(id);
    if (!instrument) {
      return null;
    }

    const result = await prisma.instrument.deleteMany({
      where: { id, tenantId: this.tenantId },
    });

    return result.count === 0 ? null : instrument;
  }
}
