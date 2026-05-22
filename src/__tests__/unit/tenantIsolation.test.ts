import { Role } from "@prisma/client";
import { runWithTenantContext } from "../../context/tenantContext";
import { prisma } from "../../config/prisma";

describe("Prisma tenant isolation extension", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lança erro quando uma query autenticada nao possui tenantId no contexto", async () => {
    await expect(
      runWithTenantContext(
        { userId: "user-1", role: Role.TENANT_ADMIN, tenantId: "" },
        async () => prisma.schedule.findMany()
      )
    ).rejects.toThrow("TenantId ausente");
  });
});
