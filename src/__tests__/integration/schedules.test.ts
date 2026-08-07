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
  await prisma.scheduleSong.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.ministryMember.deleteMany();
  await prisma.ministrySong.deleteMany();
  await prisma.song.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.ministry.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
}

async function createSong(tenantId: string, title: string) {
  const artist = await prisma.artist.create({
    data: {
      name: `Artista ${title}`,
      normalizedName: `artista-${title.toLowerCase()}`,
      tenantId,
    },
  });
  return prisma.song.create({
    data: {
      title,
      normalizedTitle: title.toLowerCase(),
      originalKey: "G",
      content: "[G]Letra",
      artistId: artist.id,
      tenantId,
    },
  });
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
      name: `UsuÃ¡rio ${seed}`,
      email: `${seed}@example.com`,
      password,
      role,
      tenantId,
    },
  });

  for (const roleName of ["Vocal", "Vocalista", "Violão", "ViolÃ£o", "Baixo", "Bateria"]) {
    const instrument = await prisma.instrument.upsert({
      where: { tenantId_name: { tenantId, name: roleName } },
      update: { isActive: true, deletedAt: null },
      create: { tenantId, name: roleName, colorHex: "#1F6F55" },
    });
    await prisma.userInstrument.create({ data: { tenantId, userId: user.id, instrumentId: instrument.id } });
  }

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

describe("Schedule notification pipeline", () => {
  it("persiste outbox atomicamente, projeta inbox, lê notificações e usa ticket único", async () => {
    const tenant = await registerTenant("notifications");
    const ministry = await createMinistry(tenant.token, "Louvor Notificações");
    const member = await createUserAndLogin("notifications-member", tenant.tenant.id);

    const invalidSchedulesBefore = await prisma.schedule.count({ where: { tenantId: tenant.tenant.id } });
    const invalidEventsBefore = await prisma.domainEventOutbox.count({ where: { tenantId: tenant.tenant.id } });
    await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ title: "Rollback", date: "2026-05-08T13:00:00.000Z", ministryId: ministry.id, assignments: [{ userId: member.user.id, role: "Inexistente" }] })
      .expect(400);
    expect(await prisma.schedule.count({ where: { tenantId: tenant.tenant.id } })).toBe(invalidSchedulesBefore);
    expect(await prisma.domainEventOutbox.count({ where: { tenantId: tenant.tenant.id } })).toBe(invalidEventsBefore);

    const created = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({
        title: "Escala notificada",
        date: "2026-05-08T13:00:00.000Z",
        ministryId: ministry.id,
        assignments: [{ userId: member.user.id, role: "Vocal" }],
      })
      .expect(201);

    const event = await prisma.domainEventOutbox.findFirst({ where: { aggregateId: created.body.data.id, type: "schedule.created" } });
    expect(event).toBeTruthy();
    expect(await prisma.schedule.findUnique({ where: { id: created.body.data.id } })).toBeTruthy();

    const { processOutboxOnce } = await import("../../events/domainEvents");
    await processOutboxOnce();

    const inbox = await request(app)
      .get("/api/notifications?limit=1&unreadOnly=true")
      .set("Authorization", `Bearer ${member.token}`)
      .expect(200);
    expect(inbox.body.data.unreadCount).toBe(1);
    expect(inbox.body.data.items[0]).toMatchObject({ type: "SCHEDULE_ASSIGNED", resourceId: created.body.data.id, readAt: null });

    const notificationId = inbox.body.data.items[0].id as string;
    await request(app)
      .patch(`/api/notifications/${notificationId}/read`)
      .set("Authorization", `Bearer ${member.token}`)
      .expect(200);
    const readInbox = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${member.token}`)
      .expect(200);
    expect(readInbox.body.data.unreadCount).toBe(0);
    expect(readInbox.body.data.items[0].readAt).toEqual(expect.any(String));

    for (const title of ["Escala notificada — ajuste 1", "Escala notificada — ajuste 2"]) {
      await request(app)
        .patch(`/api/schedules/${created.body.data.id}`)
        .set("Authorization", `Bearer ${tenant.token}`)
        .send({
          title,
          date: "2026-05-08T13:00:00.000Z",
          ministryId: ministry.id,
          songIds: [],
          assignments: [{ userId: member.user.id, role: "Vocal" }],
        })
        .expect(200);
    }
    await processOutboxOnce();
    await processOutboxOnce();
    expect(await prisma.notification.count({ where: { tenantId: tenant.tenant.id, userId: member.user.id } })).toBe(3);

    const firstPage = await request(app)
      .get("/api/notifications?limit=1")
      .set("Authorization", `Bearer ${member.token}`)
      .expect(200);
    expect(firstPage.body.data.items).toHaveLength(1);
    expect(firstPage.body.data.nextCursor).toEqual(expect.any(String));
    expect(firstPage.body.data.items[0].payload.changedFields).toEqual(["title"]);
    const secondPage = await request(app)
      .get(`/api/notifications?limit=1&cursor=${encodeURIComponent(firstPage.body.data.nextCursor)}`)
      .set("Authorization", `Bearer ${member.token}`)
      .expect(200);
    expect(secondPage.body.data.items[0].id).not.toBe(firstPage.body.data.items[0].id);

    await request(app)
      .patch(`/api/schedules/${created.body.data.id}/assignments/${created.body.data.assignments[0].id}/status`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({ status: "ACCEPTED" })
      .expect(200);
    await processOutboxOnce();
    const managerInbox = await request(app)
      .get("/api/notifications?unreadOnly=true")
      .set("Authorization", `Bearer ${tenant.token}`)
      .expect(200);
    expect(managerInbox.body.data.items[0]).toMatchObject({ type: "ASSIGNMENT_ACCEPTED", resourceId: created.body.data.id });

    await request(app)
      .post("/api/notifications/read-all")
      .set("Authorization", `Bearer ${member.token}`)
      .expect(200);
    expect((await request(app).get("/api/notifications").set("Authorization", `Bearer ${member.token}`).expect(200)).body.data.unreadCount).toBe(0);

    const ticketResponse = await request(app)
      .post("/api/notifications/realtime-ticket")
      .set("Authorization", `Bearer ${member.token}`)
      .expect(201);
    const { consumeRealtimeTicket } = await import("../../realtime/realtimeHub");
    const identity = await consumeRealtimeTicket(ticketResponse.body.data.ticket);
    expect(identity).toMatchObject({ userId: member.user.id, tenantId: tenant.tenant.id });
    expect(await consumeRealtimeTicket(ticketResponse.body.data.ticket)).toBeNull();

    const expiringTicket = await request(app)
      .post("/api/notifications/realtime-ticket")
      .set("Authorization", `Bearer ${member.token}`)
      .expect(201);
    const now = Date.now();
    const dateNow = jest.spyOn(Date, "now").mockReturnValue(now + 24 * 60 * 60 * 1000);
    try {
      expect(await consumeRealtimeTicket(expiringTicket.body.data.ticket)).toBeNull();
    } finally {
      dateNow.mockRestore();
    }

    const device = await request(app)
      .post("/api/notifications/devices")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ expoPushToken: "ExpoPushToken[test-device-token]", platform: "ANDROID", appVersion: "1.0.0" })
      .expect(201);
    await request(app)
      .delete(`/api/notifications/devices/${device.body.data.id}`)
      .set("Authorization", `Bearer ${member.token}`)
      .expect(200);
    expect(await prisma.pushDevice.findUnique({ where: { id: device.body.data.id } })).toMatchObject({ enabled: false });
  });
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
  it("retorna apenas dados do tenant do usuÃ¡rio autenticado", async () => {
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
  it("retorna 403 se usuÃ¡rio nÃ£o for TENANT_ADMIN ou MINISTRY_LEADER", async () => {
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

  it("permite criar escala com mÃºsicas e membros atribuÃ­dos", async () => {
    const tenant = await registerTenant("admin-create-full");
    const ministry = await createMinistry(tenant.token, "Louvor Completo");
    const member = await createUserAndLogin("full-member", tenant.tenant.id);
    const song = await createSong(tenant.tenant.id, "Grande Ã© o Senhor");

    const response = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({
        title: "Culto completo",
        date: "2026-05-05T13:00:00.000Z",
        ministryId: ministry.id,
        songIds: [song.id],
        assignments: [{ userId: member.user.id, role: "Vocal" }],
      })
      .expect(201);

    expect(response.body.data).toMatchObject({
      title: "Culto completo",
      songs: [{ songId: song.id }],
      assignments: [{ userId: member.user.id, role: "Vocal" }],
    });
  });

  it("exige função e rejeita função que não pertence ao perfil do membro", async () => {
    const tenant = await registerTenant("assignment-role-validation");
    const ministry = await createMinistry(tenant.token, "Louvor Validação");
    const member = await createUserAndLogin("role-validation-member", tenant.tenant.id);

    await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({
        title: "Sem função",
        date: "2026-05-05T13:00:00.000Z",
        ministryId: ministry.id,
        assignments: [{ userId: member.user.id }],
      })
      .expect(400);

    const invalid = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({
        title: "Função incompatível",
        date: "2026-05-05T13:00:00.000Z",
        ministryId: ministry.id,
        assignments: [{ userId: member.user.id, role: "Regência exclusiva" }],
      })
      .expect(400);

    expect(invalid.body.error).toContain("não está vinculada ao perfil");
  });

  it("preserva atribuição histórica e reinicia a resposta somente ao trocar a função", async () => {
    const tenant = await registerTenant("assignment-history");
    const ministry = await createMinistry(tenant.token, "Louvor Histórico");
    const member = await createUserAndLogin("history-member", tenant.tenant.id);
    const created = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({
        title: "Escala histórica",
        date: "2026-05-05T13:00:00.000Z",
        ministryId: ministry.id,
        assignments: [{ userId: member.user.id, role: "Vocal" }],
      })
      .expect(201);
    const original = created.body.data.assignments[0];

    await request(app)
      .patch(`/api/schedules/${created.body.data.id}/assignments/${original.id}/status`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({ status: "ACCEPTED" })
      .expect(200);

    const vocalLink = await prisma.userInstrument.findFirstOrThrow({
      where: { userId: member.user.id, instrument: { name: "Vocal" } },
    });
    await prisma.userInstrument.update({ where: { id: vocalLink.id }, data: { isActive: false, deletedAt: new Date() } });

    const preserved = await request(app)
      .patch(`/api/schedules/${created.body.data.id}`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({
        title: "Escala histórica ajustada",
        date: "2026-05-05T13:00:00.000Z",
        ministryId: ministry.id,
        songIds: [],
        assignments: [{ userId: member.user.id, role: "Vocal" }],
      })
      .expect(200);
    expect(preserved.body.data.assignments[0]).toMatchObject({ id: original.id, role: "Vocal", status: "ACCEPTED" });

    const changed = await request(app)
      .patch(`/api/schedules/${created.body.data.id}`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({
        title: "Escala histórica ajustada",
        date: "2026-05-05T13:00:00.000Z",
        ministryId: ministry.id,
        songIds: [],
        assignments: [{ userId: member.user.id, role: "Baixo" }],
      })
      .expect(200);
    expect(changed.body.data.assignments[0]).toMatchObject({ id: original.id, role: "Baixo", status: "PENDING", declineReason: null });
  });

  it("gera PDF do relatório da escala com músicas e membros", async () => {
    const tenant = await registerTenant("schedule-report");
    const ministry = await createMinistry(tenant.token, "Louvor Relatório");
    const member = await createUserAndLogin("report-member", tenant.tenant.id);
    const song = await createSong(tenant.tenant.id, "Canção do Relatório");

    const created = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({
        title: "Culto relatório",
        date: "2026-05-05T13:00:00.000Z",
        ministryId: ministry.id,
        songIds: [song.id],
        assignments: [{ userId: member.user.id, role: "Vocal" }],
      })
      .expect(201);

    const pdf = await request(app)
      .get(`/api/schedules/${created.body.data.id}/report`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200)
      .expect("Content-Type", /application\/pdf/);

    expect(Buffer.isBuffer(pdf.body)).toBe(true);
    expect(pdf.body.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.headers["content-disposition"]).toContain("Escala - Culto relatorio");
  });

  it("permite TENANT_ADMIN editar escala substituindo músicas e membros", async () => {
    const tenant = await registerTenant("admin-update-full");
    const ministry = await createMinistry(tenant.token, "Louvor Update");
    const firstMember = await createUserAndLogin("update-member-1", tenant.tenant.id);
    const secondMember = await createUserAndLogin("update-member-2", tenant.tenant.id);
    const firstSong = await createSong(tenant.tenant.id, "Primeira Música");
    const secondSong = await createSong(tenant.tenant.id, "Segunda Música");

    const created = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({
        title: "Culto antigo",
        date: "2026-05-05T13:00:00.000Z",
        ministryId: ministry.id,
        songIds: [firstSong.id],
        assignments: [{ userId: firstMember.user.id, role: "Vocal" }],
      })
      .expect(201);

    const updated = await request(app)
      .patch(`/api/schedules/${created.body.data.id}`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({
        title: "Culto atualizado",
        date: "2026-05-06T14:30:00.000Z",
        ministryId: ministry.id,
        songIds: [secondSong.id],
        assignments: [{ userId: secondMember.user.id, role: "Violão" }],
      })
      .expect(200);

    expect(updated.body.data).toMatchObject({
      id: created.body.data.id,
      title: "Culto atualizado",
      songs: [{ songId: secondSong.id }],
      assignments: [{ userId: secondMember.user.id, role: "Violão" }],
    });
    expect(updated.body.data.songs).toHaveLength(1);
    expect(updated.body.data.assignments).toHaveLength(1);
  });

  it("permite TENANT_ADMIN excluir escala com soft delete e desativa relacionamentos", async () => {
    const tenant = await registerTenant("admin-delete-schedule");
    const ministry = await createMinistry(tenant.token, "Louvor Delete");
    const member = await createUserAndLogin("delete-schedule-member", tenant.tenant.id);
    const song = await createSong(tenant.tenant.id, "Música Delete");

    const created = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({
        title: "Culto a excluir",
        date: "2026-05-07T13:00:00.000Z",
        ministryId: ministry.id,
        songIds: [song.id],
        assignments: [{ userId: member.user.id, role: "Vocal" }],
      })
      .expect(201);

    await prisma.scheduleAssignment.updateMany({
      where: { scheduleId: created.body.data.id },
      data: { status: "ACCEPTED" },
    });

    const deleted = await request(app)
      .delete(`/api/schedules/${created.body.data.id}`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .expect(200);

    expect(deleted.body.data).toMatchObject({ id: created.body.data.id, isActive: false });

    const stored = await prisma.schedule.findUnique({ where: { id: created.body.data.id } });
    expect(stored?.deletedAt).toBeTruthy();
    expect(await prisma.scheduleAssignment.count({ where: { scheduleId: created.body.data.id, isActive: true } })).toBe(0);
    expect(await prisma.scheduleSong.count({ where: { scheduleId: created.body.data.id, isActive: true } })).toBe(0);

    await request(app)
      .get("/api/schedules")
      .set("Authorization", `Bearer ${tenant.token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.map((item: { id: string }) => item.id)).not.toContain(created.body.data.id);
      });

    await request(app)
      .get("/api/schedules/me")
      .set("Authorization", `Bearer ${member.token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.map((item: { scheduleId: string }) => item.scheduleId)).not.toContain(created.body.data.id);
      });
  });

  it("bloqueia membro comum ao tentar excluir escala", async () => {
    const tenant = await registerTenant("member-delete-denied");
    const ministry = await createMinistry(tenant.token, "Louvor Bloqueio");
    const member = await createUserAndLogin("member-delete-denied", tenant.tenant.id);

    const created = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({
        title: "Culto protegido",
        date: "2026-05-08T13:00:00.000Z",
        ministryId: ministry.id,
      })
      .expect(201);

    await request(app)
      .delete(`/api/schedules/${created.body.data.id}`)
      .set("Authorization", `Bearer ${member.token}`)
      .expect(403);

    const stored = await prisma.schedule.findUnique({ where: { id: created.body.data.id } });
    expect(stored?.isActive).toBe(true);
    expect(stored?.deletedAt).toBeNull();
  });

  it("permite lÃ­der criar escala somente no ministÃ©rio que lÃ­dera", async () => {
    const tenant = await registerTenant("leader-own");
    const ownMinistry = await createMinistry(tenant.token, "Louvor lÃ­derado");
    const otherMinistry = await createMinistry(tenant.token, "DanÃ§a");
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
        title: "Culto lÃ­derado",
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

  it("bloqueia lÃ­der ao escalar membro fora do ministÃ©rio", async () => {
    const tenant = await registerTenant("leader-member-scope");
    const ownMinistry = await createMinistry(tenant.token, "Louvor lÃ­der");
    const leader = await createUserAndLogin("leader-member-scope", tenant.tenant.id, "MINISTRY_LEADER");
    const inMinistry = await createUserAndLogin("member-in-ministry", tenant.tenant.id);
    const outside = await createUserAndLogin("member-outside-ministry", tenant.tenant.id);

    await prisma.ministryMember.createMany({
      data: [
        { tenantId: tenant.tenant.id, userId: leader.user.id, ministryId: ownMinistry.id, isLeader: true, status: "ACTIVE" },
        { tenantId: tenant.tenant.id, userId: inMinistry.user.id, ministryId: ownMinistry.id, isLeader: false, status: "ACTIVE" },
      ],
    });

    await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${leader.token}`)
      .send({
        title: "Culto permitido",
        date: "2026-05-06T13:00:00.000Z",
        ministryId: ownMinistry.id,
        assignments: [{ userId: inMinistry.user.id, role: "Baixo" }],
      })
      .expect(201);

    await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${leader.token}`)
      .send({
        title: "Culto bloqueado",
        date: "2026-05-07T13:00:00.000Z",
        ministryId: ownMinistry.id,
        assignments: [{ userId: outside.user.id, role: "Bateria" }],
      })
      .expect(403);
  });
});

describe("Schedule assignments", () => {
  it("nÃ£o cria, atualiza ou remove assignments de outro tenant", async () => {
    const tenantA = await registerTenant("assignment-cross-a");
    const tenantB = await registerTenant("assignment-cross-b");
    const ministryA = await createMinistry(tenantA.token, "Louvor A");
    const ministryB = await createMinistry(tenantB.token, "Louvor B");
    const memberB = await createUserAndLogin("assignment-cross-member-b", tenantB.tenant.id);

    const scheduleA = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${tenantA.token}`)
      .send({
        title: "Escala A",
        date: "2026-05-11T13:00:00.000Z",
        ministryId: ministryA.id,
      })
      .expect(201);

    const scheduleB = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${tenantB.token}`)
      .send({
        title: "Escala B",
        date: "2026-05-12T13:00:00.000Z",
        ministryId: ministryB.id,
      })
      .expect(201);

    await request(app)
      .post(`/api/schedules/${scheduleA.body.data.id}/assignments`)
      .set("Authorization", `Bearer ${tenantA.token}`)
      .send({ userId: memberB.user.id, role: "Vocal" })
      .expect(404);

    const assignmentB = await request(app)
      .post(`/api/schedules/${scheduleB.body.data.id}/assignments`)
      .set("Authorization", `Bearer ${tenantB.token}`)
      .send({ userId: memberB.user.id, role: "Vocal" })
      .expect(201);

    await request(app)
      .patch(`/api/schedules/${scheduleB.body.data.id}/assignments/${assignmentB.body.data.id}/status`)
      .set("Authorization", `Bearer ${tenantA.token}`)
      .send({ status: "ACCEPTED" })
      .expect(404);

    await request(app)
      .delete(`/api/schedules/${scheduleB.body.data.id}/assignments/${assignmentB.body.data.id}`)
      .set("Authorization", `Bearer ${tenantA.token}`)
      .expect(404);

    const stored = await prisma.scheduleAssignment.findUnique({ where: { id: assignmentB.body.data.id } });
    expect(stored).toMatchObject({
      id: assignmentB.body.data.id,
      tenantId: tenantB.tenant.id,
      status: "PENDING",
    });
    expect(await prisma.scheduleAssignment.count({ where: { scheduleId: scheduleA.body.data.id } })).toBe(0);
  });

  it("permite resposta da prÃ³pria escala, registra recusa/substituiÃ§Ã£o e bloqueia operaÃ§Ãµes indevidas", async () => {
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

    const acceptResponse = await request(app)
      .patch(`/api/schedules/${scheduleId}/assignments/${assignmentId}/status`)
      .set("Authorization", `Bearer ${memberA.token}`)
      .send({ status: "ACCEPTED" })
      .expect(200);

    expect(acceptResponse.body.data).toMatchObject({
      id: assignmentId,
      status: "ACCEPTED",
    });

    await request(app)
      .patch(`/api/schedules/${scheduleId}/assignments/${assignmentId}/status`)
      .set("Authorization", `Bearer ${memberA.token}`)
      .send({ status: "DECLINED" })
      .expect(400);

    await request(app)
      .patch(`/api/schedules/${scheduleId}/assignments/${assignmentId}/status`)
      .set("Authorization", `Bearer ${memberB.token}`)
      .send({ status: "ACCEPTED" })
      .expect(403);

    const secondAssignment = await request(app)
      .post(`/api/schedules/${scheduleId}/assignments`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({
        userId: memberB.user.id,
        role: "ViolÃ£o",
      })
      .expect(201);

    const declineResponse = await request(app)
      .patch(`/api/schedules/${scheduleId}/assignments/${secondAssignment.body.data.id}/status`)
      .set("Authorization", `Bearer ${memberB.token}`)
      .send({ status: "DECLINED", declineReason: "Estou viajando", requestSubstitute: true })
      .expect(200);

    expect(declineResponse.body.data).toMatchObject({
      id: secondAssignment.body.data.id,
      status: "DECLINED",
      declineReason: "Estou viajando",
    });
    expect(declineResponse.body.data.substituteRequestedAt).toBeTruthy();

    const storedDecline = await prisma.scheduleAssignment.findUnique({ where: { id: secondAssignment.body.data.id } });
    expect(storedDecline).toMatchObject({
      declineReason: "Estou viajando",
      substituteResolvedAt: null,
      substituteResolvedById: null,
    });
    expect(storedDecline?.substituteRequestedAt).toBeTruthy();

    await request(app)
      .patch(`/api/schedules/${scheduleId}/assignments/${secondAssignment.body.data.id}/substitution/resolve`)
      .set("Authorization", `Bearer ${memberA.token}`)
      .send({ note: "Sem permissÃ£o" })
      .expect(403);

    const resolveResponse = await request(app)
      .patch(`/api/schedules/${scheduleId}/assignments/${secondAssignment.body.data.id}/substitution/resolve`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ note: "Resolvido manualmente" })
      .expect(200);

    expect(resolveResponse.body.data).toMatchObject({
      id: secondAssignment.body.data.id,
      substituteResolvedById: tenant.user.id,
      substituteResolutionNote: "Resolvido manualmente",
    });
    expect(resolveResponse.body.data.substituteResolvedAt).toBeTruthy();

    await request(app)
      .patch(`/api/schedules/${scheduleId}/assignments/${secondAssignment.body.data.id}/substitution/resolve`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ note: "Duplicado" })
      .expect(404);
  });

  it("GET /api/schedules/me retorna apenas escalas do usuÃ¡rio autenticado", async () => {
    const tenant = await registerTenant("my-schedules");
    const ministry = await createMinistry(tenant.token, "Louvor");
    const memberA = await createUserAndLogin("my-schedules-a", tenant.tenant.id);
    const memberB = await createUserAndLogin("my-schedules-b", tenant.tenant.id);
    const song = await createSong(tenant.tenant.id, "Canção da agenda");

    const scheduleA = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({
        title: "Escala A",
        date: "2026-05-09T13:00:00.000Z",
        ministryId: ministry.id,
        songIds: [song.id],
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
      .send({ userId: memberB.user.id, role: "ViolÃ£o" })
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
        songs: [{ songId: song.id, song: { id: song.id, title: "Canção da agenda", originalKey: "G", bpm: null } }],
      },
    });
  });
});

