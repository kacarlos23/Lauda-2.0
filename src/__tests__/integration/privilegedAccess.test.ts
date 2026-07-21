import { execFileSync } from "node:child_process";
import path from "node:path";
import type express from "express";
import request from "supertest";
import { Role } from "@prisma/client";
import { GenericContainer, StartedTestContainer } from "testcontainers";
import type { prisma as PrismaClientInstance } from "../../config/prisma";
import { totpCode } from "../../security/mfa";
import { createCrossTenantHarness, RegisteredTenant } from "../helpers/crossTenantHarness";

let app: express.Express;
let prisma: typeof PrismaClientInstance;
let container: StartedTestContainer;

function migrate(databaseUrl: string) {
  execFileSync(process.execPath, [path.resolve("node_modules", "prisma", "build", "index.js"), "migrate", "deploy"], {
    env: { PATH: process.env.PATH, NODE_ENV: "test", DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });
}

async function cleanDatabase() {
  await prisma.supportAccessGrant.deleteMany();
  await prisma.adminAuditLog.deleteMany();
  await prisma.userPermission.deleteMany();
  await prisma.scheduleAssignment.deleteMany();
  await prisma.scheduleSong.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.ministryMember.deleteMany();
  await prisma.ministrySong.deleteMany();
  await prisma.song.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.userInstrument.deleteMany();
  await prisma.instrument.deleteMany();
  await prisma.memberInvite.deleteMany();
  await prisma.ministry.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
}

async function registerTenant(seed: string): Promise<RegisteredTenant> {
  const response = await request(app).post("/api/auth/register").send({
    churchName: `Igreja ${seed}`,
    name: `Admin ${seed}`,
    email: `admin-${seed}@example.com`,
    password: "secret123",
  }).expect(201);
  return response.body.data;
}

async function createSong(tenant: RegisteredTenant, label: string) {
  const artist = await request(app).post("/api/artists")
    .set("Authorization", `Bearer ${tenant.accessToken}`)
    .send({ name: `Artista ${label}` }).expect(201);
  const song = await request(app).post("/api/songs")
    .set("Authorization", `Bearer ${tenant.accessToken}`)
    .send({
      title: `Canção ${label}`,
      artistId: artist.body.data.id,
      originalKey: "G",
      content: "[G]Conteúdo",
    }).expect(201);
  return { artist: artist.body.data, song: song.body.data };
}

async function createMember(tenant: RegisteredTenant, seed: string) {
  const email = `${seed}@example.com`;
  const created = await request(app).post("/api/members")
    .set("Authorization", `Bearer ${tenant.accessToken}`)
    .send({ name: `Suporte ${seed}`, email, password: "member123", role: "MEMBER" }).expect(201);
  const login = await request(app).post("/api/auth/login").send({ email, password: "member123" }).expect(200);
  return { user: created.body.data as { id: string }, accessToken: login.body.data.accessToken as string };
}

beforeAll(async () => {
  container = await new GenericContainer("postgres:16-alpine").withEnvironment({
    POSTGRES_DB: "lauda_privileged_test", POSTGRES_USER: "test", POSTGRES_PASSWORD: "test",
  }).withExposedPorts(5432).start();
  const databaseUrl = `postgresql://test:test@${container.getHost()}:${container.getMappedPort(5432)}/lauda_privileged_test`;
  Object.assign(process.env, {
    DATABASE_URL: databaseUrl,
    JWT_SECRET: "test_access_secret",
    REFRESH_JWT_SECRET: "test_refresh_secret",
    NODE_ENV: "test",
    RATE_LIMIT_ENABLED: "false",
  });
  migrate(databaseUrl);
  app = (await import("../../app")).default;
  prisma = (await import("../../config/prisma")).prisma;
}, 120_000);

beforeEach(cleanDatabase);
afterAll(async () => {
  await prisma.$disconnect();
  await container.stop();
});

describe("Etapa 3 privileged access", () => {
  it("persists canonical tenant/ownership despite protected-property injection", async () => {
    const tenantA = await registerTenant("mass-a");
    const tenantB = await registerTenant("mass-b");
    const artist = await request(app).post("/api/artists")
      .set("Authorization", `Bearer ${tenantA.accessToken}`)
      .send({ name: "Artista seguro", tenantId: tenantB.tenant.id, isActive: false, deletedAt: new Date().toISOString() })
      .expect(201);
    const storedArtist = await prisma.artist.findUniqueOrThrow({ where: { id: artist.body.data.id } });
    expect(storedArtist).toMatchObject({ tenantId: tenantA.tenant.id, isActive: true, deletedAt: null });

    const created = await request(app).post("/api/songs")
      .set("Authorization", `Bearer ${tenantA.accessToken}`)
      .send({
        title: "Canção segura", artistId: artist.body.data.id, originalKey: "G", content: "[G]Conteúdo",
        tenantId: tenantB.tenant.id, createdById: tenantB.user.id, role: "GLOBAL_ADMIN", isActive: false,
      }).expect(201);
    await request(app).patch(`/api/songs/${created.body.data.id}`)
      .set("Authorization", `Bearer ${tenantA.accessToken}`)
      .send({ title: "Canção atualizada", tenantId: tenantB.tenant.id, createdById: tenantB.user.id, deletedAt: new Date().toISOString() })
      .expect(200);
    const storedSong = await prisma.song.findUniqueOrThrow({ where: { id: created.body.data.id } });
    expect(storedSong).toMatchObject({
      tenantId: tenantA.tenant.id,
      createdById: tenantA.user.id,
      isActive: true,
      deletedAt: null,
      title: "Canção atualizada",
    });
  });

  it("uses a reusable A/B harness for path, filter, relational body and export isolation", async () => {
    const fixture = await createCrossTenantHarness({
      seed: "matrix",
      registerTenant,
      seedResource: (tenant, label) => createSong(tenant, label),
    });
    const { tenantA, resourceB } = fixture;

    await request(app).get(`/api/artists/${resourceB.artist.id}`)
      .set("Authorization", `Bearer ${tenantA.accessToken}`).expect(404);
    await request(app).get(`/api/songs/${resourceB.song.id}`)
      .set("Authorization", `Bearer ${tenantA.accessToken}`).expect(404);
    const filtered = await request(app).get(`/api/songs?artistId=${resourceB.artist.id}&tenantId=${fixture.tenantB.tenant.id}`)
      .set("Authorization", `Bearer ${tenantA.accessToken}`).expect(200);
    expect(filtered.body.data.items).toEqual([]);
    const searchedAndPaginated = await request(app)
      .get(`/api/songs?search=${encodeURIComponent(resourceB.song.title)}&page=1&limit=1&tenantId=${fixture.tenantB.tenant.id}`)
      .set("Authorization", `Bearer ${tenantA.accessToken}`).expect(200);
    expect(searchedAndPaginated.body.data.items).toEqual([]);
    expect(searchedAndPaginated.body.data.pagination.total).toBe(0);
    await request(app).post("/api/songs")
      .set("Authorization", `Bearer ${tenantA.accessToken}`)
      .send({ title: "Forjada", artistId: resourceB.artist.id, originalKey: "G", content: "[G]Conteúdo" })
      .expect(404);
    await request(app).post("/api/songs/export")
      .set("Authorization", `Bearer ${tenantA.accessToken}`)
      .send({ songIds: [resourceB.song.id] }).expect(404);

    const ministryB = await request(app).post("/api/ministries")
      .set("Authorization", `Bearer ${fixture.tenantB.accessToken}`)
      .send({ name: "Ministério B" }).expect(201);
    const scheduleB = await request(app).post("/api/schedules")
      .set("Authorization", `Bearer ${fixture.tenantB.accessToken}`)
      .send({
        title: "Escala B",
        date: "2026-08-02T12:00:00.000Z",
        ministryId: ministryB.body.data.id,
        songIds: [resourceB.song.id],
        assignments: [],
      }).expect(201);
    await request(app).get(`/api/schedules/${scheduleB.body.data.id}/report`)
      .set("Authorization", `Bearer ${tenantA.accessToken}`).expect(404);

    expect(await prisma.song.findUnique({ where: { id: resourceB.song.id } })).toMatchObject({ title: "Canção B" });

    await prisma.user.update({ where: { id: tenantA.user.id }, data: { role: Role.GLOBAL_ADMIN, tenantId: null } });
    const globalView = await request(app).get(`/api/admin/songs?tenantId=${fixture.tenantB.tenant.id}`)
      .set("Authorization", `Bearer ${tenantA.accessToken}`).expect(200);
    expect(globalView.body.data.map((song: { id: string }) => song.id)).toContain(resourceB.song.id);
  });

  it("binds read-only support to grantee session, tenant, resource, ticket and expiry with audit", async () => {
    const tenantA = await registerTenant("support-a");
    const tenantB = await registerTenant("support-b");
    const resourceB = await createSong(tenantB, "Suporte B");
    const support = await createMember(tenantA, "support-agent");
    const secondLogin = await request(app).post("/api/auth/login")
      .send({ email: "support-agent@example.com", password: "member123" }).expect(200);

    await prisma.user.update({ where: { id: tenantA.user.id }, data: { role: Role.GLOBAL_ADMIN, tenantId: null } });
    const grantResponse = await request(app).post("/api/admin/support-access-grants")
      .set("Authorization", `Bearer ${tenantA.accessToken}`)
      .send({
        granteeId: support.user.id,
        tenantId: tenantB.tenant.id,
        resource: "songs",
        scopes: ["read"],
        ticketReference: "SUP-2026-001",
        reason: "Diagnóstico solicitado pelo tenant B",
        expiresInMinutes: 30,
      }).expect(201);
    const grantId = grantResponse.body.data.id as string;

    const supported = await request(app).get("/api/support/songs")
      .set("Authorization", `Bearer ${support.accessToken}`)
      .set("x-support-access-id", grantId).expect(200);
    expect(supported.body.data.items.map((song: { id: string }) => song.id)).toEqual([resourceB.song.id]);
    await request(app).get("/api/support/users")
      .set("Authorization", `Bearer ${support.accessToken}`)
      .set("x-support-access-id", grantId).expect(403);
    await request(app).get("/api/support/songs")
      .set("Authorization", `Bearer ${secondLogin.body.data.accessToken}`)
      .set("x-support-access-id", grantId).expect(403);

    await prisma.supportAccessGrant.update({ where: { id: grantId }, data: { expiresAt: new Date(Date.now() - 1_000) } });
    await request(app).get("/api/support/songs")
      .set("Authorization", `Bearer ${support.accessToken}`)
      .set("x-support-access-id", grantId).expect(403);
    const actions = await prisma.adminAuditLog.findMany({ where: { resourceId: grantId }, select: { action: true } });
    expect(actions.map((item) => item.action)).toEqual(expect.arrayContaining(["support_access_granted"]));
    expect(await prisma.adminAuditLog.count({ where: { action: "support_access_used", actorId: support.user.id } })).toBe(1);
  });

  it("enrolls MFA and records a short-lived step-up on the current server session", async () => {
    const tenant = await registerTenant("mfa");
    const setup = await request(app).post("/api/auth/mfa/setup")
      .set("Authorization", `Bearer ${tenant.accessToken}`)
      .send({ currentPassword: "secret123", role: "GLOBAL_ADMIN", tenantId: null }).expect(200);
    const code = totpCode(setup.body.data.secret);
    await request(app).post("/api/auth/mfa/confirm")
      .set("Authorization", `Bearer ${tenant.accessToken}`).send({ code }).expect(200);
    const elevated = await request(app).post("/api/auth/step-up")
      .set("Authorization", `Bearer ${tenant.accessToken}`)
      .send({ currentPassword: "secret123", code }).expect(200);
    expect(new Date(elevated.body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());
    const session = await prisma.authSession.findFirstOrThrow({ where: { userId: tenant.user.id } });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: tenant.user.id } });
    expect(user.mfaEnabledAt).not.toBeNull();
    expect(user.mfaSecretEncrypted).not.toContain(setup.body.data.secret);
    expect(session.mfaVerifiedAt).not.toBeNull();
    expect(session.stepUpExpiresAt).not.toBeNull();
  });
});
