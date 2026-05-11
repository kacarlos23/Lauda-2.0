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
  it("retorna apenas dados do tenant do usuario autenticado", async () => {
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
  it("retorna 403 se usuario nao for TENANT_ADMIN ou MINISTRY_LEADER", async () => {
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
});
