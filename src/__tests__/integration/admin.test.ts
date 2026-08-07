import { execFileSync } from "node:child_process";
import path from "node:path";
import type express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { GenericContainer, StartedTestContainer } from "testcontainers";
import { config } from "../../config/unifiedConfig";
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

  const authenticated = await login(email, "member123");
  const instrument = await prisma.instrument.findFirstOrThrow({
    where: { tenantId: authenticated.user.tenantId, name: "Vocalista" },
  });
  await prisma.userInstrument.create({
    data: { tenantId: authenticated.user.tenantId, userId: authenticated.user.id, instrumentId: instrument.id },
  });
  return authenticated;
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

async function createSong(tenantId: string, title: string) {
  const artist = await prisma.artist.create({
    data: {
      tenantId,
      name: `Artista ${title}`,
      normalizedName: `artista ${title.toLowerCase()}`,
    },
  });

  return prisma.song.create({
    data: {
      tenantId,
      artistId: artist.id,
      title,
      normalizedTitle: title.toLowerCase(),
      originalKey: "C",
      content: "[Intro] C",
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
  it("executa CRUD global padronizado, lifecycle, log e bloqueia relaÃ§Ãµes entre igrejas", async () => {
    const tenantA = await registerTenant("ops-a");
    const tenantB = await registerTenant("ops-b");
    const ministryA = await createMinistry(tenantA.accessToken, "Louvor Ops A");
    await prisma.user.update({ where: { id: tenantA.user.id }, data: { role: Role.GLOBAL_ADMIN, tenantId: null } });
    const globalAdmin = await login(tenantA.user.email);
    const memberB = await createMember(tenantB.accessToken, "member-ops-b", "MEMBER");
    const scheduleA = await createSchedule(tenantA.tenant.id, ministryA.id, "Culto Ops A");

    const instrumentCreate = await request(app)
      .post("/api/admin/instruments")
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .set("X-Request-ID", "admin-create-instrument-001")
      .send({ tenantId: tenantA.tenant.id, name: "Violão Global Ops", colorHex: "#123456" })
      .expect(201);
    expect(instrumentCreate.body.data).toMatchObject({ name: "Violão Global Ops", tenantId: tenantA.tenant.id, isActive: true });

    const instrumentId = instrumentCreate.body.data.id;
    const correlatedAudit = await prisma.adminAuditLog.findFirst({
      where: { action: "create", resource: "instruments", resourceId: instrumentId },
      select: { requestId: true, payload: true },
    });
    expect(correlatedAudit).toEqual({
      requestId: "admin-create-instrument-001",
      payload: { changedFields: ["colorHex", "name", "tenantId"] },
    });
    await request(app)
      .patch(`/api/admin/instruments/${instrumentId}`)
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .send({ name: "Violão Global Editado" })
      .expect(200);

    const deactivated = await request(app)
      .post(`/api/admin/instruments/${instrumentId}/deactivate`)
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .expect(200);
    expect(deactivated.body.data).toMatchObject({ isActive: false });
    expect(deactivated.body.data.deletedAt).toBeTruthy();

    await request(app)
      .post(`/api/admin/instruments/${instrumentId}/activate`)
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .expect(200);

    await request(app)
      .delete(`/api/admin/instruments/${instrumentId}`)
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .expect(400);

    await request(app)
      .delete(`/api/admin/instruments/${instrumentId}?confirm=permanent`)
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .expect(200);

    const userCreate = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .send({
        tenantId: tenantA.tenant.id,
        name: "Usuário Operação",
        email: "usuario-operacao@example.com",
        password: "secret123",
        role: Role.MEMBER,
      })
      .expect(201);
    expect(JSON.stringify(userCreate.body.data)).not.toContain("secret123");
    await request(app).post("/api/auth/login").send({ email: "usuario-operacao@example.com", password: "secret123" }).expect(200);

    await request(app)
      .post(`/api/admin/users/${userCreate.body.data.id}/deactivate`)
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .expect(200);
    await request(app).post("/api/auth/login").send({ email: "usuario-operacao@example.com", password: "secret123" }).expect(401);

    await request(app)
      .post("/api/admin/schedule-assignments")
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .send({ tenantId: tenantA.tenant.id, scheduleId: scheduleA.id, userId: memberB.user.id, role: "Vocal", status: "PENDING" })
      .expect(400);

    const logs = await request(app)
      .get("/api/admin/audit-logs?search=instruments")
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .expect(200);
    expect(logs.body.data.items.some((log: { action: string; resource: string }) => log.action === "create" && log.resource === "instruments")).toBe(true);

    await request(app).post("/api/admin/instruments").set("Authorization", `Bearer ${tenantB.accessToken}`).send({ tenantId: tenantB.tenant.id, name: "Bloqueado" }).expect(403);
  });

  it("permite GLOBAL_ADMIN sem igreja gerenciar igreja, usuário, música e escala", async () => {
    const tenant = await registerTenant("global-null-tenant");
    const member = await createMember(tenant.accessToken, "member-global-edit", "MEMBER");
    const assignee = await createMember(tenant.accessToken, "member-global-assignee", "MEMBER");
    const ministry = await createMinistry(tenant.accessToken, "Louvor Edit Global");
    const song = await createSong(tenant.tenant.id, "Canção Global");
    const schedule = await createSchedule(tenant.tenant.id, ministry.id, "Culto Global");

    await prisma.user.update({
      where: { id: tenant.user.id },
      data: { role: Role.GLOBAL_ADMIN, tenantId: null },
    });
    const globalAdmin = await login(tenant.user.email);

    expect(globalAdmin.user.role).toBe(Role.GLOBAL_ADMIN);
    expect(globalAdmin.user.tenantId).toBeNull();
    expect(jwt.decode(globalAdmin.accessToken)).toMatchObject({ role: Role.GLOBAL_ADMIN, tenantId: null });

    const tenantsResponse = await request(app)
      .get("/api/admin/tenants")
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .expect(200);
    expect(tenantsResponse.body.data.some((item: { id: string }) => item.id === tenant.tenant.id)).toBe(true);

    const tenantPatch = await request(app)
      .patch(`/api/admin/tenants/${tenant.tenant.id}`)
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .send({ name: "Igreja Global Editada", domain: "global-editada.local" })
      .expect(200);
    expect(tenantPatch.body.data).toMatchObject({ id: tenant.tenant.id, name: "Igreja Global Editada", domain: "global-editada.local" });

    const userPatch = await request(app)
      .patch(`/api/admin/users/${member.user.id}`)
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .send({
        name: "Usuário Global Editado",
        email: "usuario-global-editado@example.com",
        role: Role.GLOBAL_ADMIN,
        tenantId: null,
        password: "novaSenha123",
        reason: "Promoção administrativa coberta pelo teste",
        ticketReference: "SEC-TEST-001",
        confirmation: "PROMOTE member-global-edit@example.com",
      })
      .expect(200);
    expect(userPatch.body.data).toMatchObject({
      id: member.user.id,
      name: "Usuário Global Editado",
      email: "usuario-global-editado@example.com",
      role: Role.GLOBAL_ADMIN,
      tenantId: null,
    });
    expect(JSON.stringify(userPatch.body.data)).not.toContain("password");
    await request(app).post("/api/auth/login").send({ email: "usuario-global-editado@example.com", password: "novaSenha123" }).expect(200);

    const songPatch = await request(app)
      .patch(`/api/admin/songs/${song.id}`)
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .send({ title: "Canção Global Editada", originalKey: "G", cifraUrl: "https://example.com/cifra" })
      .expect(200);
    expect(songPatch.body.data).toMatchObject({ id: song.id, title: "Canção Global Editada", originalKey: "G", cifraUrl: "https://example.com/cifra" });

    const schedulePatch = await request(app)
      .patch(`/api/admin/schedules/${schedule.id}`)
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .send({
        title: "Culto Global Editado",
        songIds: [song.id],
        assignments: [{ userId: assignee.user.id, role: "Vocalista" }],
      })
      .expect(200);
    expect(schedulePatch.body.data).toMatchObject({ id: schedule.id, title: "Culto Global Editado" });
    expect(schedulePatch.body.data.songs).toHaveLength(1);
    expect(schedulePatch.body.data.assignments).toHaveLength(1);

    const outboxBeforeDelete = await prisma.domainEventOutbox.count({ where: { aggregateId: schedule.id } });
    await request(app)
      .delete(`/api/admin/schedule-assignments/${schedulePatch.body.data.assignments[0].id}?confirm=permanent`)
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .expect(200);
    expect(await prisma.domainEventOutbox.count({ where: { aggregateId: schedule.id } })).toBe(outboxBeforeDelete + 1);
    expect(await prisma.scheduleAssignment.count({ where: { scheduleId: schedule.id } })).toBe(0);
  });

  it("aceita GLOBAL_ADMIN sem igreja mesmo quando o token salvo não traz tenantId atualizado", async () => {
    const tenant = await registerTenant("global-stale-token");
    await prisma.user.update({
      where: { id: tenant.user.id },
      data: { role: Role.GLOBAL_ADMIN, tenantId: null },
    });
    const staleToken = tenant.accessToken;

    await request(app)
      .get("/api/admin/tenants")
      .set("Authorization", `Bearer ${staleToken}`)
      .expect(200);
  });

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

  it("aplica overrides ALLOW/DENY imediatamente e audita a alteração", async () => {
    const actorTenant = await registerTenant("permission-actor");
    const targetTenant = await registerTenant("permission-target");
    await prisma.user.update({ where: { id: actorTenant.user.id }, data: { role: Role.GLOBAL_ADMIN } });
    const globalAdmin = await login(actorTenant.user.email);

    const catalog = await request(app)
      .get("/api/admin/permissions")
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .expect(200);
    expect(catalog.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "permissions:manage", assignable: false }),
      expect.objectContaining({ key: "member:manage_access", assignable: true }),
    ]));
    expect(catalog.body.data.some((item: { key: string }) => item.key === "reports:view")).toBe(false);

    const denied = await request(app)
      .put(`/api/admin/users/${targetTenant.user.id}/permissions`)
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .send({ overrides: [{ permissionKey: "member:view", effect: "DENY" }] })
      .expect(200);
    expect(denied.body.data.baseline).toContain("member:view");
    expect(denied.body.data.effective).not.toContain("member:view");
    expect(denied.body.data.overrides).toEqual(expect.arrayContaining([
      expect.objectContaining({ effect: "DENY", permission: expect.objectContaining({ key: "member:view" }) }),
    ]));

    await request(app).get("/api/members").set("Authorization", `Bearer ${targetTenant.accessToken}`).expect(403);

    const legacy = await request(app)
      .put(`/api/admin/users/${targetTenant.user.id}/permissions`)
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .send({ permissionKeys: ["member:assign_permissions"] })
      .expect(200);
    expect(legacy.body.data.overrides[0]).toMatchObject({
      effect: "ALLOW",
      permission: { key: "member:manage_access" },
    });
    expect(legacy.body.data.effective).toContain("member:view");
    await request(app).get("/api/members").set("Authorization", `Bearer ${targetTenant.accessToken}`).expect(200);

    await request(app)
      .post(`/api/admin/users/${targetTenant.user.id}/permissions`)
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .send({ permissionKey: "permissions:manage", effect: "ALLOW" })
      .expect(400);
    await request(app)
      .put(`/api/admin/users/${actorTenant.user.id}/permissions`)
      .set("Authorization", `Bearer ${globalAdmin.accessToken}`)
      .send({ overrides: [] })
      .expect(403);

    const audit = await prisma.adminAuditLog.findFirst({
      where: { actorId: actorTenant.user.id, resource: "user-permissions", resourceId: targetTenant.user.id },
      orderBy: { createdAt: "desc" },
    });
    expect(audit?.action).toBe("set_permission_overrides");
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
