import { execFileSync } from "node:child_process";
import path from "node:path";
import type express from "express";
import request from "supertest";
import { Role } from "@prisma/client";
import { GenericContainer, StartedTestContainer } from "testcontainers";
import type { prisma as PrismaClientInstance } from "../../config/prisma";

let app: express.Express;
let prisma: typeof PrismaClientInstance;
let container: StartedTestContainer;

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

async function cleanDatabase(): Promise<void> {
  await prisma.scheduleAssignment.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.ministryMember.deleteMany();
  await prisma.ministrySong.deleteMany();
  await prisma.song.deleteMany();
  await prisma.ministry.deleteMany();
  await prisma.memberInvite.deleteMany();
  await prisma.userInstrument.deleteMany();
  await prisma.instrument.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
}

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
    accessToken: string;
    user: { id: string; email: string; tenantId: string };
    tenant: { id: string; name: string };
  };
}

async function login(email: string, password = "secret123") {
  const response = await request(app).post("/api/auth/login").send({ email, password }).expect(200);
  return response.body.data as { accessToken: string; user: { id: string; role: Role; tenantId: string } };
}

async function createMember(token: string, seed: string, role: "MEMBER" | "MINISTRY_LEADER" = "MEMBER") {
  const email = `${seed}@example.com`;
  await request(app)
    .post("/api/members")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: `UsuÃ¡rio ${seed}`, email, password: "member123", role })
    .expect(201);

  return login(email, "member123");
}

async function createMinistry(token: string, name: string) {
  const response = await request(app)
    .post("/api/ministries")
    .set("Authorization", `Bearer ${token}`)
    .send({ name, description: `MinistÃ©rio ${name}` })
    .expect(201);

  return response.body.data as { id: string; tenantId: string; name: string };
}

beforeAll(async () => {
  container = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({
      POSTGRES_DB: "lauda_admin_test",
      POSTGRES_USER: "test",
      POSTGRES_PASSWORD: "test",
    })
    .withExposedPorts(5432)
    .start();

  const databaseUrl = `postgresql://test:test@${container.getHost()}:${container.getMappedPort(5432)}/lauda_admin_test`;
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET = "test_access_secret";
  process.env.REFRESH_JWT_SECRET = "test_refresh_secret";
  process.env.JWT_EXPIRES_IN = "15m";
  process.env.REFRESH_JWT_EXPIRES_IN = "7d";
  process.env.NODE_ENV = "test";

  migrate(databaseUrl);

  const appModule = await import("../../app");
  const prismaModule = await import("../../config/prisma");
  app = appModule.default;
  prisma = prismaModule.prisma;
}, 60000);

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

describe("Admin global API", () => {
  it("permite GLOBAL_ADMIN listar todos os tenants e bloqueia demais roles", async () => {
    const tenantA = await registerTenant("global-a");
    const tenantB = await registerTenant("global-b");
    await prisma.user.update({ where: { id: tenantA.user.id }, data: { role: Role.GLOBAL_ADMIN } });
    const globalAdmin = await login(tenantA.user.email);
    const member = await createMember(tenantA.accessToken, "member-admin-global", "MEMBER");
    const leader = await createMember(tenantA.accessToken, "leader-admin-global", "MINISTRY_LEADER");

    const response = await request(app)
      .get("/api/admin/tenants")
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .expect(200);

    expect(response.body.data.map((tenant: { id: string }) => tenant.id).sort()).toEqual(
      [tenantA.tenant.id, tenantB.tenant.id].sort()
    );
    expect(response.body.data[0]._count).toMatchObject({
      users: expect.any(Number),
      ministries: expect.any(Number),
      schedules: expect.any(Number),
      instruments: expect.any(Number),
    });

    await request(app).get("/api/admin/tenants").set("Authorization", `Bearer ${tenantB.accessToken}`).expect(403);
    await request(app).get("/api/admin/tenants").set("Authorization", `Bearer ${leader.accessToken}`).expect(403);
    await request(app).get("/api/admin/tenants").set("Authorization", `Bearer ${member.accessToken}`).expect(403);
    await request(app).get("/api/admin/tenants").expect(401);
  });

  it("detalha tenant, lista usuÃ¡rios sem senha, filtra por tenantId e valida tenantId invÃ¡lido", async () => {
    const tenantA = await registerTenant("detail-a");
    const tenantB = await registerTenant("detail-b");
    await prisma.user.update({ where: { id: tenantA.user.id }, data: { role: Role.GLOBAL_ADMIN } });
    const globalAdmin = await login(tenantA.user.email);
    await createMember(tenantA.accessToken, "member-detail-a");
    await createMember(tenantB.accessToken, "member-detail-b");

    const tenantResponse = await request(app)
      .get(`/api/admin/tenants/${tenantB.tenant.id}`)
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .expect(200);
    expect(tenantResponse.body.data.id).toBe(tenantB.tenant.id);
    expect(tenantResponse.body.data.users.length).toBeGreaterThan(0);
    expect(JSON.stringify(tenantResponse.body.data)).not.toContain("password");

    const usersResponse = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .expect(200);
    expect(usersResponse.body.data.length).toBeGreaterThanOrEqual(4);
    expect(usersResponse.body.data[0]).not.toHaveProperty("password");
    expect(usersResponse.body.data[0]).not.toHaveProperty("passwordHash");

    const filteredResponse = await request(app)
      .get(`/api/admin/users?tenantId=${tenantB.tenant.id}`)
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .expect(200);
    expect(filteredResponse.body.data.every((user: { tenantId: string }) => user.tenantId === tenantB.tenant.id)).toBe(true);

    await request(app)
      .get("/api/admin/users?tenantId=not-a-uuid")
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .expect(400);
  });

  it("lista ministÃ©rios globais com tenant e mantÃ©m endpoints normais tenant-scoped", async () => {
    const tenantA = await registerTenant("ministries-a");
    const tenantB = await registerTenant("ministries-b");
    await prisma.user.update({ where: { id: tenantA.user.id }, data: { role: Role.GLOBAL_ADMIN } });
    const globalAdmin = await login(tenantA.user.email);
    const ministryA = await createMinistry(tenantA.accessToken, "Louvor A");
    const ministryB = await createMinistry(tenantB.accessToken, "Louvor B");
    const memberA = await createMember(tenantA.accessToken, "member-scoped-a");

    const globalResponse = await request(app)
      .get("/api/admin/ministries")
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .expect(200);
    expect(globalResponse.body.data.map((ministry: { id: string }) => ministry.id).sort()).toEqual(
      [ministryA.id, ministryB.id].sort()
    );
    expect(globalResponse.body.data[0].tenant).toMatchObject({ id: expect.any(String), name: expect.any(String) });

    const tenantResponse = await request(app)
      .get("/api/ministries")
      .set("Authorization", `Bearer ${tenantB.accessToken}`)
      .expect(200);
    expect(tenantResponse.body.data.map((ministry: { id: string }) => ministry.id)).toEqual([ministryB.id]);

    const memberResponse = await request(app)
      .get("/api/members/me")
      .set("Authorization", `Bearer ${memberA.accessToken}`)
      .expect(200);
    expect(memberResponse.body.data.tenantId).toBe(tenantA.tenant.id);
  });
});
