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

  update(id: string, data: UpdateInstrumentInput) {
    return prisma.instrument.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.colorHex !== undefined ? { colorHex: data.colorHex } : {}),
      },
      select: instrumentSelect,
    });
  }

  delete(id: string) {
    return prisma.instrument.delete({
      where: { id },
      select: instrumentSelect,
    });
  }
}
