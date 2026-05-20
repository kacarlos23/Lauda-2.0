import { execFileSync } from "node:child_process";
import path from "node:path";
import type express from "express";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import request from "supertest";
import { GenericContainer, StartedTestContainer } from "testcontainers";
import type { prisma as PrismaClientInstance } from "../../config/prisma";

let app: express.Express;
let prisma: typeof PrismaClientInstance;
let container: StartedTestContainer;

/**
 * Runs Prisma migrations against the Testcontainers database.
 *
 * @param databaseUrl Connection string exposed by the PostgreSQL container.
 * @returns Nothing; throws when migrations fail.
 */
function migrate(databaseUrl: string): void {
  const prismaCli = path.resolve("node_modules", "prisma", "build", "index.js");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    env: {
      PATH: process.env.PATH,
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: databaseUrl,
    },
    stdio: "inherit",
  });
}

/**
 * Removes tenant-owned data in dependency order.
 *
 * @returns A promise that resolves after the database is empty.
 */
async function cleanDatabase(): Promise<void> {
  await prisma.scheduleAssignment.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.ministryMember.deleteMany();
  await prisma.ministrySong.deleteMany();
  await prisma.song.deleteMany();
  await prisma.ministry.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
}

/**
 * Registers a tenant through the public API.
 *
 * @param seed Unique label used for tenant and user data.
 * @returns Auth payload returned by the API.
 */
async function registerTenant(seed: string) {
  const response = await request(app)
    .post("/api/auth/register")
    .send({
      churchName: `Igreja ${seed}`,
      name: `Admin ${seed}`,
      email: `admin-${seed}@example.com`,
      password: "secret123",
    })
    .expect(201);

  return response.body.data as {
    token: string;
    refreshToken: string;
    tenant: { id: string; name: string };
    user: { id: string; email: string; name: string; role: string };
  };
}

/**
 * Creates a ministry through the public API.
 *
 * @param token Access token for the tenant admin.
 * @param name Ministry name.
 * @returns Created ministry.
 */
async function createMinistry(token: string, name: string) {
  const response = await request(app)
    .post("/api/ministries")
    .set("Authorization", `Bearer ${token}`)
    .send({ name })
    .expect(201);

  return response.body.data as { id: string; tenantId: string; name: string };
}

async function createUser(seed: string, tenantId: string, role: Role = Role.MEMBER) {
  const password = await bcrypt.hash("secret123", 10);
  return prisma.user.create({
    data: {
      name: `Usuário ${seed}`,
      email: `${seed}@example.com`,
      password,
      role,
      tenantId,
    },
  });
}

async function login(email: string) {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "secret123" })
    .expect(200);

  return response.body.data.token as string;
}

async function createSchedule(token: string, ministryId: string, title = "Culto") {
  const response = await request(app)
    .post("/api/schedules")
    .set("Authorization", `Bearer ${token}`)
    .send({
      title,
      date: "2026-05-03T13:00:00.000Z",
      ministryId,
    })
    .expect(201);

  return response.body.data as { id: string; ministryId: string; tenantId: string; title: string };
}

beforeAll(async () => {
  container = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({
      POSTGRES_DB: "lauda_test",
      POSTGRES_USER: "test",
      POSTGRES_PASSWORD: "test",
    })
    .withExposedPorts(5432)
    .start();

  const databaseUrl = `postgresql://test:test@${container.getHost()}:${container.getMappedPort(
    5432
  )}/lauda_test`;
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET = "test_access_secret";
  process.env.REFRESH_JWT_SECRET = "test_refresh_secret";
  process.env.NODE_ENV = "test";

  migrate(databaseUrl);

  const appModule = await import("../../app");
  const prismaModule = await import("../../config/prisma");
  app = appModule.default;
  prisma = prismaModule.prisma;
});

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  if (prisma) {
    await cleanDatabase();
    await prisma.$disconnect();
  }
  if (container) {
    await container.stop();
  }
});

describe("POST /api/auth/login", () => {
  it("retorna 200 com tokens para credenciais validas", async () => {
    await registerTenant("login-ok");

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin-login-ok@example.com", password: "secret123" })
      .expect(200);

    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).toEqual(expect.any(String));
  });

  it("retorna 401 para credenciais inválidas", async () => {
    await registerTenant("login-fail");

    await request(app)
      .post("/api/auth/login")
      .send({ email: "admin-login-fail@example.com", password: "wrong123" })
      .expect(401);
  });
});

describe("GET /api/schedules", () => {
  it("retorna apenas dados do tenant do usuário autenticado", async () => {
    const tenantA = await registerTenant("tenant-a");
    const tenantB = await registerTenant("tenant-b");
    const ministryA = await createMinistry(tenantA.token, "Louvor A");
    const ministryB = await createMinistry(tenantB.token, "Louvor B");

    await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${tenantA.token}`)
      .send({
        title: "Culto tenant A",
        date: "2026-05-03T13:00:00.000Z",
        ministryId: ministryA.id,
      })
      .expect(201);

    await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${tenantB.token}`)
      .send({
        title: "Culto tenant B",
        date: "2026-05-04T13:00:00.000Z",
        ministryId: ministryB.id,
      })
      .expect(201);

    const response = await request(app)
      .get("/api/schedules")
      .set("Authorization", `Bearer ${tenantA.token}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      title: "Culto tenant A",
      tenantId: tenantA.tenant.id,
    });
  });

  it("usuário autenticado so acessa schedules do proprio tenant", async () => {
    const tenantA = await registerTenant("tenant-own-a");
    const tenantB = await registerTenant("tenant-own-b");
    const ministryA = await createMinistry(tenantA.token, "Louvor A");
    const ministryB = await createMinistry(tenantB.token, "Louvor B");

    await createSchedule(tenantA.token, ministryA.id, "Escala A");
    await createSchedule(tenantB.token, ministryB.id, "Escala B");

    const response = await request(app)
      .get("/api/schedules")
      .set("Authorization", `Bearer ${tenantB.token}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].title).toBe("Escala B");
    expect(response.body.data[0].tenantId).toBe(tenantB.tenant.id);
  });
});

describe("POST /api/schedules", () => {
  it("TENANT_ADMIN cria escala com sucesso", async () => {
    const tenant = await registerTenant("tenant-admin-create");
    const ministry = await createMinistry(tenant.token, "Louvor");

    const response = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({
        title: "Culto admin",
        date: "2026-05-03T13:00:00.000Z",
        ministryId: ministry.id,
      })
      .expect(201);

    expect(response.body.data).toMatchObject({
      title: "Culto admin",
      tenantId: tenant.tenant.id,
      ministryId: ministry.id,
    });
  });

  it("GLOBAL_ADMIN cria escala com sucesso no proprio tenant", async () => {
    const tenant = await registerTenant("global-admin-create");
    const ministry = await createMinistry(tenant.token, "Louvor");
    const admin = await createUser("global-admin-create", tenant.tenant.id, Role.GLOBAL_ADMIN);
    const token = await login(admin.email);

    await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Culto global",
        date: "2026-05-03T13:00:00.000Z",
        ministryId: ministry.id,
      })
      .expect(201);
  });

  it("MINISTRY_LEADER cria escala no ministério em que lídera", async () => {
    const tenant = await registerTenant("leader-create");
    const ministry = await createMinistry(tenant.token, "Louvor");
    const leader = await createUser("leader-create", tenant.tenant.id, Role.MINISTRY_LEADER);
    await prisma.ministryMember.create({
      data: { tenantId: tenant.tenant.id, ministryId: ministry.id, userId: leader.id, isLeader: true },
    });
    const token = await login(leader.email);

    await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Culto líder",
        date: "2026-05-03T13:00:00.000Z",
        ministryId: ministry.id,
      })
      .expect(201);
  });

  it("MINISTRY_LEADER recebe 403 ao tentar criar escala em ministério que não lidera", async () => {
    const tenant = await registerTenant("leader-denied");
    const ministry = await createMinistry(tenant.token, "Louvor");
    const otherMinistry = await createMinistry(tenant.token, "Recepcao");
    const leader = await createUser("leader-denied", tenant.tenant.id, Role.MINISTRY_LEADER);
    await prisma.ministryMember.create({
      data: { tenantId: tenant.tenant.id, ministryId: ministry.id, userId: leader.id, isLeader: true },
    });
    const token = await login(leader.email);

    await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Culto bloqueado",
        date: "2026-05-03T13:00:00.000Z",
        ministryId: otherMinistry.id,
      })
      .expect(403);
  });

  it("usuário do Tenant A não cria escala usando ministryId do Tenant B", async () => {
    const tenantA = await registerTenant("cross-create-a");
    const tenantB = await registerTenant("cross-create-b");
    const ministryB = await createMinistry(tenantB.token, "Louvor B");

    await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${tenantA.token}`)
      .send({
        title: "Culto inválido",
        date: "2026-05-03T13:00:00.000Z",
        ministryId: ministryB.id,
      })
      .expect(404);
  });

  it("retorna 403 se usuário não for TENANT_ADMIN ou MINISTRY_LEADER", async () => {
    const tenant = await registerTenant("member-denied");
    const ministry = await createMinistry(tenant.token, "Louvor");
    const member = await createUser("member-denied", tenant.tenant.id, Role.MEMBER);
    const token = await login(member.email);

    await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Culto bloqueado",
        date: "2026-05-03T13:00:00.000Z",
        ministryId: ministry.id,
      })
      .expect(403);
  });
});

describe("Schedule assignments", () => {
  it("admin adiciona membro a escala", async () => {
    const tenant = await registerTenant("assign-admin");
    const ministry = await createMinistry(tenant.token, "Louvor");
    const schedule = await createSchedule(tenant.token, ministry.id, "Culto");
    const member = await createUser("assign-admin-member", tenant.tenant.id);

    const response = await request(app)
      .post(`/api/schedules/${schedule.id}/assignments`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ userId: member.id, role: "Vocal" })
      .expect(201);

    expect(response.body.data).toMatchObject({
      scheduleId: schedule.id,
      userId: member.id,
      role: "Vocal",
      status: "PENDING",
      tenantId: tenant.tenant.id,
    });
  });

  it("líder do ministério adiciona membro a escala", async () => {
    const tenant = await registerTenant("assign-leader");
    const ministry = await createMinistry(tenant.token, "Louvor");
    const schedule = await createSchedule(tenant.token, ministry.id);
    const leader = await createUser("assign-leader-user", tenant.tenant.id, Role.MINISTRY_LEADER);
    const member = await createUser("assign-leader-member", tenant.tenant.id);
    await prisma.ministryMember.create({
      data: { tenantId: tenant.tenant.id, ministryId: ministry.id, userId: leader.id, isLeader: true },
    });
    const token = await login(leader.email);

    await request(app)
      .post(`/api/schedules/${schedule.id}/assignments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ userId: member.id, role: "Violao" })
      .expect(201);
  });

  it("líder de outro ministério não adiciona membro a escala", async () => {
    const tenant = await registerTenant("assign-other-leader");
    const ministry = await createMinistry(tenant.token, "Louvor");
    const otherMinistry = await createMinistry(tenant.token, "Recepcao");
    const schedule = await createSchedule(tenant.token, ministry.id);
    const leader = await createUser("assign-other-leader-user", tenant.tenant.id, Role.MINISTRY_LEADER);
    const member = await createUser("assign-other-leader-member", tenant.tenant.id);
    await prisma.ministryMember.create({
      data: { tenantId: tenant.tenant.id, ministryId: otherMinistry.id, userId: leader.id, isLeader: true },
    });
    const token = await login(leader.email);

    await request(app)
      .post(`/api/schedules/${schedule.id}/assignments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ userId: member.id, role: "Violao" })
      .expect(403);
  });

  it("membro comum não adiciona assignment", async () => {
    const tenant = await registerTenant("assign-member-denied");
    const ministry = await createMinistry(tenant.token, "Louvor");
    const schedule = await createSchedule(tenant.token, ministry.id);
    const member = await createUser("assign-member-denied-user", tenant.tenant.id);
    const token = await login(member.email);

    await request(app)
      .post(`/api/schedules/${schedule.id}/assignments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ userId: member.id, role: "Vocal" })
      .expect(403);
  });

  it("não permite adicionar usuário de outro tenant", async () => {
    const tenantA = await registerTenant("assign-cross-a");
    const tenantB = await registerTenant("assign-cross-b");
    const ministryA = await createMinistry(tenantA.token, "Louvor A");
    const schedule = await createSchedule(tenantA.token, ministryA.id);
    const memberB = await createUser("assign-cross-member-b", tenantB.tenant.id);

    await request(app)
      .post(`/api/schedules/${schedule.id}/assignments`)
      .set("Authorization", `Bearer ${tenantA.token}`)
      .send({ userId: memberB.id, role: "Vocal" })
      .expect(404);
  });

  it("não permite assignment duplicado", async () => {
    const tenant = await registerTenant("assign-duplicate");
    const ministry = await createMinistry(tenant.token, "Louvor");
    const schedule = await createSchedule(tenant.token, ministry.id);
    const member = await createUser("assign-duplicate-member", tenant.tenant.id);

    await request(app)
      .post(`/api/schedules/${schedule.id}/assignments`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ userId: member.id, role: "Vocal" })
      .expect(201);

    await request(app)
      .post(`/api/schedules/${schedule.id}/assignments`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ userId: member.id, role: "Vocal" })
      .expect(400);
  });

  it("membro aceita e recusa a propria escala", async () => {
    const tenant = await registerTenant("assign-status-own");
    const ministry = await createMinistry(tenant.token, "Louvor");
    const schedule = await createSchedule(tenant.token, ministry.id);
    const member = await createUser("assign-status-own-member", tenant.tenant.id);
    const assignment = await prisma.scheduleAssignment.create({
      data: { tenantId: tenant.tenant.id, scheduleId: schedule.id, userId: member.id, role: "Vocal" },
    });
    const token = await login(member.email);

    await request(app)
      .patch(`/api/schedules/${schedule.id}/assignments/${assignment.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "ACCEPTED" })
      .expect(200);

    const response = await request(app)
      .patch(`/api/schedules/${schedule.id}/assignments/${assignment.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "DECLINED" })
      .expect(200);

    expect(response.body.data.status).toBe("DECLINED");
  });

  it("membro não altera assignment de outro membro", async () => {
    const tenant = await registerTenant("assign-status-other");
    const ministry = await createMinistry(tenant.token, "Louvor");
    const schedule = await createSchedule(tenant.token, ministry.id);
    const owner = await createUser("assign-status-owner", tenant.tenant.id);
    const other = await createUser("assign-status-other-member", tenant.tenant.id);
    const assignment = await prisma.scheduleAssignment.create({
      data: { tenantId: tenant.tenant.id, scheduleId: schedule.id, userId: owner.id, role: "Vocal" },
    });
    const token = await login(other.email);

    await request(app)
      .patch(`/api/schedules/${schedule.id}/assignments/${assignment.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "ACCEPTED" })
      .expect(403);
  });

  it("DELETE remove assignment quando feito por admin ou líder do ministério", async () => {
    const tenant = await registerTenant("assign-delete");
    const ministry = await createMinistry(tenant.token, "Louvor");
    const schedule = await createSchedule(tenant.token, ministry.id);
    const member = await createUser("assign-delete-member", tenant.tenant.id);
    const leader = await createUser("assign-delete-leader", tenant.tenant.id, Role.MINISTRY_LEADER);
    await prisma.ministryMember.create({
      data: { tenantId: tenant.tenant.id, ministryId: ministry.id, userId: leader.id, isLeader: true },
    });
    const leaderToken = await login(leader.email);
    const firstAssignment = await prisma.scheduleAssignment.create({
      data: { tenantId: tenant.tenant.id, scheduleId: schedule.id, userId: member.id, role: "Vocal" },
    });

    await request(app)
      .delete(`/api/schedules/${schedule.id}/assignments/${firstAssignment.id}`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .expect(200);

    const secondAssignment = await prisma.scheduleAssignment.create({
      data: { tenantId: tenant.tenant.id, scheduleId: schedule.id, userId: member.id, role: "Vocal" },
    });

    await request(app)
      .delete(`/api/schedules/${schedule.id}/assignments/${secondAssignment.id}`)
      .set("Authorization", `Bearer ${leaderToken}`)
      .expect(200);
  });

  it("DELETE retorna 403 para líder de outro ministério", async () => {
    const tenant = await registerTenant("assign-delete-denied");
    const ministry = await createMinistry(tenant.token, "Louvor");
    const otherMinistry = await createMinistry(tenant.token, "Recepcao");
    const schedule = await createSchedule(tenant.token, ministry.id);
    const member = await createUser("assign-delete-denied-member", tenant.tenant.id);
    const leader = await createUser("assign-delete-denied-leader", tenant.tenant.id, Role.MINISTRY_LEADER);
    await prisma.ministryMember.create({
      data: { tenantId: tenant.tenant.id, ministryId: otherMinistry.id, userId: leader.id, isLeader: true },
    });
    const assignment = await prisma.scheduleAssignment.create({
      data: { tenantId: tenant.tenant.id, scheduleId: schedule.id, userId: member.id, role: "Vocal" },
    });
    const token = await login(leader.email);

    await request(app)
      .delete(`/api/schedules/${schedule.id}/assignments/${assignment.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });

  it("GET /api/schedules/me retorna apenas escalas do usuário autenticado e do proprio tenant", async () => {
    const tenantA = await registerTenant("me-a");
    const tenantB = await registerTenant("me-b");
    const ministryA = await createMinistry(tenantA.token, "Louvor A");
    const ministryB = await createMinistry(tenantB.token, "Louvor B");
    const scheduleA = await createSchedule(tenantA.token, ministryA.id, "Minha escala");
    const scheduleB = await createSchedule(tenantB.token, ministryB.id, "Outra escala");
    const memberA = await createUser("me-member-a", tenantA.tenant.id);
    const memberB = await createUser("me-member-b", tenantB.tenant.id);
    await prisma.scheduleAssignment.create({
      data: { tenantId: tenantA.tenant.id, scheduleId: scheduleA.id, userId: memberA.id, role: "Vocal" },
    });
    await prisma.scheduleAssignment.create({
      data: { tenantId: tenantB.tenant.id, scheduleId: scheduleB.id, userId: memberB.id, role: "Vocal" },
    });
    const token = await login(memberA.email);

    const response = await request(app)
      .get("/api/schedules/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      status: "PENDING",
      role: "Vocal",
      schedule: {
        id: scheduleA.id,
        title: "Minha escala",
        ministry: { id: ministryA.id, name: "Louvor A" },
      },
    });
  });
});
