import { Role } from "@prisma/client";
import { AdminRepository } from "../../repositories/AdminRepository";

describe("AdminRepository", () => {
  it("lista tenants com Prisma global sem filtrar pelo tenantId do GLOBAL_ADMIN", async () => {
    const tenants = [
      {
        id: "tenant-a",
        name: "Igreja A",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        _count: { users: 2, ministries: 1, schedules: 3, instruments: 4 },
      },
      {
        id: "tenant-b",
        name: "Igreja B",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        _count: { users: 1, ministries: 2, schedules: 0, instruments: 5 },
      },
    ];
    const findMany = jest.fn().mockResolvedValue(tenants);
    const db = { tenant: { findMany } };
    const repository = new AdminRepository(db as never);

    await expect(repository.listTenants()).resolves.toEqual(tenants);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { createdAt: "desc" },
      select: expect.objectContaining({
        id: true,
        name: true,
        domain: true,
        isActive: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { users: true, ministries: true, schedules: true, instruments: true } },
      }),
      skip: 0,
      take: 200,
    }));
    expect(JSON.stringify(findMany.mock.calls[0][0])).not.toContain("tenantId");
  });

  it("preserva contagens reais retornadas pelo Prisma", async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: "tenant-a",
        name: "Igreja A",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        _count: { users: 7, ministries: 3, schedules: 2, instruments: 9 },
      },
    ]);
    const repository = new AdminRepository({ tenant: { findMany } } as never);

    const result = await repository.listTenants();

    expect(result[0]._count).toEqual({ users: 7, ministries: 3, schedules: 2, instruments: 9 });
  });

  it("não exige tenantId mesmo quando o usuário global possui tenant próprio", async () => {
    const globalAdmin = { id: "user-1", role: Role.GLOBAL_ADMIN, tenantId: "tenant-a" };
    const findMany = jest.fn().mockResolvedValue([]);
    const repository = new AdminRepository({ tenant: { findMany } } as never);

    await repository.listTenants();

    expect(globalAdmin.tenantId).toBe("tenant-a");
    expect(JSON.stringify(findMany.mock.calls[0][0])).not.toContain(globalAdmin.tenantId);
  });

  it("aceita paginação e busca opcionais em listTenants", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const repository = new AdminRepository({ tenant: { findMany } } as never);

    await repository.listTenants({ page: 2, limit: 25, search: "Igreja" });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [{ name: { contains: "Igreja", mode: "insensitive" } }] },
      skip: 25,
      take: 25,
    }));
  });

  it("limpa logs de auditoria antigos em lote limitado por cleanupAuditLogs", async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: "log-1" }, { id: "log-2" }]);
    const deleteMany = jest.fn().mockResolvedValue({ count: 2 });
    const repository = new AdminRepository({ adminAuditLog: { findMany, deleteMany } } as never);

    const result = await repository.cleanupAuditLogs(90, 500);

    expect(findMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: expect.any(Date) } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: 500,
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["log-1", "log-2"] } },
    });
    expect(result.deletedCount).toBe(2);
    expect(result.cutoff).toBeInstanceOf(Date);
  });
});
