import { execFileSync } from "node:child_process";
import path from "node:path";
import type express from "express";
import bcrypt from "bcryptjs";
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

async function createUserAndLogin(seed: string, tenantId: string, role: "MEMBER" | "MINISTRY_LEADER" = "MEMBER") {
  const password = await bcrypt.hash("secret123", 10);
  const user = await prisma.user.create({
    data: {
      name: `Usuário ${seed}`,
      email: `${seed}@example.com`,
      password,
      role,
      tenantId,
    },
  });

  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: user.email, password: "secret123" })
    .expect(200);

  return {
    user,
    token: login.body.data.token as string,
  };
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

  it("retorna 401 para credenciais invalidas", async () => {
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
});

describe("POST /api/schedules", () => {
  it("retorna 403 se usuário não for TENANT_ADMIN ou MINISTRY_LEADER", async () => {
    const tenant = await registerTenant("member-denied");
    const ministry = await createMinistry(tenant.token, "Louvor");
    const password = await bcrypt.hash("secret123", 10);
    const member = await prisma.user.create({
      data: {
        name: "Membro",
        email: "member-denied@example.com",
        password,
        role: "MEMBER",
        tenantId: tenant.tenant.id,
      },
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: member.email, password: "secret123" })
      .expect(200);

    await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${login.body.data.token}`)
      .send({
        title: "Culto bloqueado",
        date: "2026-05-03T13:00:00.000Z",
        ministryId: ministry.id,
      })
      .expect(403);
  });

  it("permite TENANT_ADMIN criar escala", async () => {
    const tenant = await registerTenant("admin-create");
    const ministry = await createMinistry(tenant.token, "Louvor Admin");

    await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({
        title: "Culto admin",
        date: "2026-05-05T13:00:00.000Z",
        ministryId: ministry.id,
      })
      .expect(201);
  });

  it("permite líder criar escala somente no ministério que lidera", async () => {
    const tenant = await registerTenant("leader-own");
    const ownMinistry = await createMinistry(tenant.token, "Louvor liderado");
    const otherMinistry = await createMinistry(tenant.token, "Dança");
    const leader = await createUserAndLogin("leader-own", tenant.tenant.id, "MINISTRY_LEADER");

    await prisma.ministryMember.create({
      data: {
        tenantId: tenant.tenant.id,
        userId: leader.user.id,
        ministryId: ownMinistry.id,
        isLeader: true,
        status: "ACTIVE",
      },
    });

    await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${leader.token}`)
      .send({
        title: "Culto liderado",
        date: "2026-05-06T13:00:00.000Z",
        ministryId: ownMinistry.id,
      })
      .expect(201);

    await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${leader.token}`)
      .send({
        title: "Culto bloqueado",
        date: "2026-05-07T13:00:00.000Z",
        ministryId: otherMinistry.id,
      })
      .expect(403);
  });
});

describe("Schedule assignments", () => {
  it("permite membro aceitar e recusar a propria escala e bloqueia assignment de outro membro", async () => {
    const tenant = await registerTenant("assignment-status");
    const ministry = await createMinistry(tenant.token, "Louvor");
    const memberA = await createUserAndLogin("assignment-member-a", tenant.tenant.id);
    const memberB = await createUserAndLogin("assignment-member-b", tenant.tenant.id);

    const scheduleResponse = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({
        title: "Culto com escala",
        date: "2026-05-08T13:00:00.000Z",
        ministryId: ministry.id,
      })
      .expect(201);

    const scheduleId = scheduleResponse.body.data.id as string;

    const assignmentResponse = await request(app)
      .post(`/api/schedules/${scheduleId}/assignments`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({
        userId: memberA.user.id,
        role: "Vocal",
      })
      .expect(201);

    const assignmentId = assignmentResponse.body.data.id as string;

    await request(app)
      .patch(`/api/schedules/${scheduleId}/assignments/${assignmentId}/status`)
      .set("Authorization", `Bearer ${memberA.token}`)
      .send({ status: "ACCEPTED" })
      .expect(200);

    await request(app)
      .patch(`/api/schedules/${scheduleId}/assignments/${assignmentId}/status`)
      .set("Authorization", `Bearer ${memberA.token}`)
      .send({ status: "DECLINED" })
      .expect(200);

    await request(app)
      .patch(`/api/schedules/${scheduleId}/assignments/${assignmentId}/status`)
      .set("Authorization", `Bearer ${memberB.token}`)
      .send({ status: "ACCEPTED" })
      .expect(403);
  });

  it("GET /api/schedules/me retorna apenas escalas do usuário autenticado", async () => {
    const tenant = await registerTenant("my-schedules");
    const ministry = await createMinistry(tenant.token, "Louvor");
    const memberA = await createUserAndLogin("my-schedules-a", tenant.tenant.id);
    const memberB = await createUserAndLogin("my-schedules-b", tenant.tenant.id);

    const scheduleA = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({
        title: "Escala A",
        date: "2026-05-09T13:00:00.000Z",
        ministryId: ministry.id,
      })
      .expect(201);

    const scheduleB = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({
        title: "Escala B",
        date: "2026-05-10T13:00:00.000Z",
        ministryId: ministry.id,
      })
      .expect(201);

    await request(app)
      .post(`/api/schedules/${scheduleA.body.data.id}/assignments`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ userId: memberA.user.id, role: "Vocal" })
      .expect(201);

    await request(app)
      .post(`/api/schedules/${scheduleB.body.data.id}/assignments`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ userId: memberB.user.id, role: "Violão" })
      .expect(201);

    const response = await request(app)
      .get("/api/schedules/me")
      .set("Authorization", `Bearer ${memberA.token}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      userId: memberA.user.id,
      status: "PENDING",
      schedule: {
        title: "Escala A",
        ministry: { id: ministry.id, name: "Louvor" },
      },
    });
  });
});
