import { execFileSync } from "node:child_process";
import path from "node:path";
import type express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { GenericContainer, StartedTestContainer } from "testcontainers";
import type { prisma as PrismaClientInstance } from "../../config/prisma";

let app: express.Express;
let prisma: typeof PrismaClientInstance;
let container: StartedTestContainer;

type AdminTenantListItem = {
  id: string;
  _count: {
    users: number;
    ministries: number;
    schedules: number;
    instruments: number;
  };
};

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
    .send({ name: `Usuário ${seed}`, email, password: "member123", role })
    .expect(201);

  return login(email, "member123");
}

async function createMinistry(token: string, name: string) {
  const response = await request(app)
    .post("/api/ministries")
    .set("Authorization", `Bearer ${token}`)
    .send({ name, description: `Ministério ${name}` })
    .expect(201);

  return response.body.data as { id: string; tenantId: string; name: string };
}

async function createSchedule(tenantId: string, ministryId: string, title: string) {
  return prisma.schedule.create({
    data: {
      tenantId,
      ministryId,
      title,
      date: new Date("2099-01-01T12:00:00.000Z"),
    },
  });
}

async function createInstrument(token: string, name: string) {
  const response = await request(app)
    .post("/api/instruments")
    .set("Authorization", `Bearer ${token}`)
    .send({ name, colorHex: "#123456" })
    .expect(201);

  return response.body.data as { id: string; name: string };
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
    await createMember(tenantB.accessToken, "member-admin-global-b", "MEMBER");
    const ministryA = await createMinistry(tenantA.accessToken, "Louvor Global A");
    const ministryB = await createMinistry(tenantB.accessToken, "Louvor Global B");
    await createInstrument(globalAdmin.accessToken, "Violino Global A");
    await createInstrument(tenantB.accessToken, "Violino Global B");
    await createSchedule(tenantA.tenant.id, ministryA.id, "Culto Global A");
    await createSchedule(tenantB.tenant.id, ministryB.id, "Culto Global B");

    expect(globalAdmin.user.role).toBe(Role.GLOBAL_ADMIN);
    expect(jwt.decode(globalAdmin.accessToken)).toMatchObject({ role: Role.GLOBAL_ADMIN });

    const response = await request(app)
      .get("/api/admin/tenants")
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.map((tenant: { id: string }) => tenant.id).sort()).toEqual(
      [tenantA.tenant.id, tenantB.tenant.id].sort()
    );
    expect(JSON.stringify(response.body.data)).not.toContain("password");
    expect(JSON.stringify(response.body.data)).not.toContain("passwordHash");
    expect(JSON.stringify(response.body.data)).not.toContain("resetPasswordToken");
    expect(JSON.stringify(response.body.data)).not.toContain("resetPasswordExpires");

    const tenantsById = new Map<string, AdminTenantListItem>(
      response.body.data.map((tenant: AdminTenantListItem) => [tenant.id, tenant])
    );
    expect(tenantsById.get(tenantA.tenant.id)?._count).toMatchObject({
      users: 3,
      ministries: 1,
      schedules: 1,
      instruments: 14,
    });
    expect(tenantsById.get(tenantB.tenant.id)?._count).toMatchObject({
      users: 2,
      ministries: 1,
      schedules: 1,
      instruments: 14,
    });
    expect(tenantsById.get(tenantA.tenant.id)?._count.users).toBeGreaterThan(0);
    expect(tenantsById.get(tenantA.tenant.id)?._count.ministries).toBe(1);
    expect(tenantsById.get(tenantA.tenant.id)?._count.instruments).toBe(14);

    expect(globalAdmin.user.tenantId).toBe(tenantA.tenant.id);
    expect(response.body.data.some((tenant: { id: string }) => tenant.id === tenantB.tenant.id)).toBe(true);

    await request(app).get("/api/admin/tenants").set("Authorization", `Bearer ${tenantB.accessToken}`).expect(403);
    await request(app).get("/api/admin/tenants").set("Authorization", `Bearer ${leader.accessToken}`).expect(403);
    await request(app).get("/api/admin/tenants").set("Authorization", `Bearer ${member.accessToken}`).expect(403);
    await request(app).get("/api/admin/tenants").expect(401);
  });

  it("detalha tenant, lista usuários sem senha, filtra por tenantId e valida tenantId inválido", async () => {
    const tenantA = await registerTenant("detail-a");
    const tenantB = await registerTenant("detail-b");
    await prisma.user.update({ where: { id: tenantA.user.id }, data: { role: Role.GLOBAL_ADMIN } });
    const globalAdmin = await login(tenantA.user.email);
    await createMember(tenantA.accessToken, "member-detail-a");
    const memberB = await createMember(tenantB.accessToken, "member-detail-b");

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
    expect(usersResponse.body.data.some((user: { tenantId: string }) => user.tenantId === tenantA.tenant.id)).toBe(true);
    expect(usersResponse.body.data.some((user: { tenantId: string }) => user.tenantId === tenantB.tenant.id)).toBe(true);
    expect(usersResponse.body.data[0].tenant).toMatchObject({ id: expect.any(String), name: expect.any(String) });
    expect(usersResponse.body.data[0]).not.toHaveProperty("password");
    expect(usersResponse.body.data[0]).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(usersResponse.body.data)).not.toContain("password");

    const filteredResponse = await request(app)
      .get(`/api/admin/users?tenantId=${tenantB.tenant.id}`)
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .expect(200);
    expect(filteredResponse.body.data.every((user: { tenantId: string }) => user.tenantId === tenantB.tenant.id)).toBe(true);

    await request(app)
      .get("/api/admin/users?tenantId=not-a-uuid")
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .expect(400);

    await request(app).get("/api/admin/users").set("Authorization", `Bearer ${tenantB.accessToken}`).expect(403);
    await request(app).get("/api/admin/users").set("Authorization", `Bearer ${memberB.accessToken}`).expect(403);
  });

  it("lista ministérios globais com tenant e mantém endpoints normais tenant-scoped", async () => {
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

describe("Administração da igreja", () => {
  it("permite TENANT_ADMIN ver e atualizar apenas a própria igreja", async () => {
    const tenantA = await registerTenant("church-a");
    const tenantB = await registerTenant("church-b");
    const ministryA = await createMinistry(tenantA.accessToken, "Louvor Igreja A");
    const ministryB = await createMinistry(tenantB.accessToken, "Louvor Igreja B");
    await createMember(tenantA.accessToken, "member-church-a");
    await createMember(tenantB.accessToken, "member-church-b");
    await createSchedule(tenantA.tenant.id, ministryA.id, "Culto Igreja A");
    await createSchedule(tenantB.tenant.id, ministryB.id, "Culto Igreja B");

    const summaryResponse = await request(app)
      .get("/api/church/me")
      .set("Authorization", `Bearer ${tenantA.accessToken}`)
      .expect(200);

    expect(summaryResponse.body.data.tenant.id).toBe(tenantA.tenant.id);
    expect(summaryResponse.body.data.tenant.name).toBe(tenantA.tenant.name);
    expect(summaryResponse.body.data._count).toMatchObject({
      users: 2,
      ministries: 1,
      schedules: 1,
      instruments: 13,
    });
    expect(JSON.stringify(summaryResponse.body.data)).not.toContain("password");
    expect(JSON.stringify(summaryResponse.body.data)).not.toContain("passwordHash");

    const updateResponse = await request(app)
      .patch("/api/church/me")
      .set("Authorization", `Bearer ${tenantA.accessToken}`)
      .send({ name: "Igreja Atualizada A" })
      .expect(200);

    expect(updateResponse.body.data.tenant.id).toBe(tenantA.tenant.id);
    expect(updateResponse.body.data.tenant.name).toBe("Igreja Atualizada A");

    const unchangedTenantB = await prisma.tenant.findUnique({ where: { id: tenantB.tenant.id } });
    expect(unchangedTenantB?.name).toBe(tenantB.tenant.name);
  });

  it("bloqueia roles sem permissão e anônimos", async () => {
    const tenant = await registerTenant("church-roles");
    const member = await createMember(tenant.accessToken, "member-church-roles", "MEMBER");
    const leader = await createMember(tenant.accessToken, "leader-church-roles", "MINISTRY_LEADER");

    await request(app).get("/api/church/me").set("Authorization", `Bearer ${leader.accessToken}`).expect(403);
    await request(app).get("/api/church/me").set("Authorization", `Bearer ${member.accessToken}`).expect(403);
    await request(app).get("/api/church/me").expect(401);
  });

  it("overview retorna apenas dados do tenant autenticado e não expõe senha", async () => {
    const tenantA = await registerTenant("church-overview-a");
    const tenantB = await registerTenant("church-overview-b");
    const ministryA = await createMinistry(tenantA.accessToken, "Louvor Overview A");
    const ministryB = await createMinistry(tenantB.accessToken, "Louvor Overview B");
    const memberA = await createMember(tenantA.accessToken, "member-overview-a");
    await createMember(tenantB.accessToken, "member-overview-b");
    await createInstrument(tenantA.accessToken, "Violino Overview A");
    await createInstrument(tenantB.accessToken, "Violino Overview B");
    const scheduleA = await createSchedule(tenantA.tenant.id, ministryA.id, "Culto Overview A");
    await createSchedule(tenantB.tenant.id, ministryB.id, "Culto Overview B");

    const response = await request(app)
      .get("/api/church/overview")
      .set("Authorization", `Bearer ${tenantA.accessToken}`)
      .expect(200);

    expect(response.body.data.tenant.id).toBe(tenantA.tenant.id);
    expect(response.body.data.members.some((member: { id: string }) => member.id === memberA.user.id)).toBe(true);
    expect(response.body.data.members.every((member: { tenantId: string }) => member.tenantId === tenantA.tenant.id)).toBe(true);
    expect(response.body.data.ministries.map((ministry: { id: string }) => ministry.id)).toContain(ministryA.id);
    expect(response.body.data.ministries.map((ministry: { id: string }) => ministry.id)).not.toContain(ministryB.id);
    expect(response.body.data.schedules.map((schedule: { id: string }) => schedule.id)).toContain(scheduleA.id);
    expect(response.body.data.schedules.every((schedule: { tenantId: string }) => schedule.tenantId === tenantA.tenant.id)).toBe(true);
    expect(response.body.data.instruments.every((instrument: { name: string }) => !instrument.name.includes("Overview B"))).toBe(true);
    expect(JSON.stringify(response.body.data)).not.toContain("password");
    expect(JSON.stringify(response.body.data)).not.toContain("passwordHash");
  });

  it("valida nome vazio no PATCH /api/church/me", async () => {
    const tenant = await registerTenant("church-validation");

    await request(app)
      .patch("/api/church/me")
      .set("Authorization", `Bearer ${tenant.accessToken}`)
      .send({ name: "" })
      .expect(400);
  });
});
