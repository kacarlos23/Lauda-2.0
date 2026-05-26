import { execFileSync } from "node:child_process";
import path from "node:path";
import type express from "express";
import request from "supertest";
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
  await prisma.userInstrument.deleteMany();
  await prisma.instrument.deleteMany();
  await prisma.scheduleAssignment.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.ministryMember.deleteMany();
  await prisma.ministrySong.deleteMany();
  await prisma.song.deleteMany();
  await prisma.ministry.deleteMany();
  await prisma.memberInvite.deleteMany();
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

  return response.body.data;
}

async function createMember(token: string, seed: string, role: "MEMBER" | "MINISTRY_LEADER" = "MEMBER") {
  const response = await request(app)
    .post("/api/members")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: `Membro ${seed}`,
      email: `${seed}@example.com`,
      password: "member123",
      role,
    })
    .expect(201);

  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: `${seed}@example.com`, password: "member123" })
    .expect(200);

  return { user: response.body.data, token: login.body.data.token as string };
}

async function createInstrument(token: string, name: string, colorHex = "#2563EB") {
  const response = await request(app)
    .post("/api/instruments")
    .set("Authorization", `Bearer ${token}`)
    .send({ name, colorHex })
    .expect(201);

  return response.body.data as { id: string; name: string; colorHex: string | null };
}

beforeAll(async () => {
  container = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({
      POSTGRES_DB: "lauda_instruments_test",
      POSTGRES_USER: "test",
      POSTGRES_PASSWORD: "test",
    })
    .withExposedPorts(5432)
    .start();

  const databaseUrl = `postgresql://test:test@${container.getHost()}:${container.getMappedPort(
    5432
  )}/lauda_instruments_test`;
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

describe("Instruments API", () => {
  it("lista apenas instrumentos do tenant autenticado e permite acesso de MEMBER", async () => {
    const tenantA = await registerTenant("instruments-list-a");
    const tenantB = await registerTenant("instruments-list-b");
    const member = await createMember(tenantA.token, "instrument-list-member");

    await createInstrument(tenantA.token, "Teclado");
    await createInstrument(tenantB.token, "Bateria");

    const response = await request(app)
      .get("/api/instruments")
      .set("Authorization", `Bearer ${member.token}`)
      .expect(200);

    expect(response.body.data).toEqual([{ id: expect.any(String), name: "Teclado", colorHex: "#2563EB" }]);
  });

  it("TENANT_ADMIN cria instrumento, MEMBER não cria, e validação rejeita payload inválido", async () => {
    const tenant = await registerTenant("instruments-create");
    const member = await createMember(tenant.token, "instrument-create-member");

    await createInstrument(tenant.token, "Vocal", "#10B981");

    await request(app)
      .post("/api/instruments")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ name: "Violão", colorHex: "#F59E0B" })
      .expect(403);

    await request(app)
      .post("/api/instruments")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ name: "", colorHex: "#F59E0B" })
      .expect(400);

    await request(app)
      .post("/api/instruments")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ name: "Guitarra", colorHex: "blue" })
      .expect(400);
  });

  it("bloqueia nome duplicado no tenant e permite mesmo nome em tenants diferentes", async () => {
    const tenantA = await registerTenant("instruments-dup-a");
    const tenantB = await registerTenant("instruments-dup-b");

    await createInstrument(tenantA.token, "Baixo");
    await createInstrument(tenantB.token, "Baixo");

    const duplicate = await request(app)
      .post("/api/instruments")
      .set("Authorization", `Bearer ${tenantA.token}`)
      .send({ name: "Baixo" });

    expect(duplicate.status).toBe(400);
    expect(duplicate.body.error).toBe("Já existe um instrumento com este nome");
  });

  it("PATCH e DELETE respeitam tenant e não alteram instrumento de outro tenant", async () => {
    const tenantA = await registerTenant("instruments-update-a");
    const tenantB = await registerTenant("instruments-update-b");
    const instrumentA = await createInstrument(tenantA.token, "Som");
    const instrumentB = await createInstrument(tenantB.token, "Mídia");

    await request(app)
      .patch(`/api/instruments/${instrumentB.id}`)
      .set("Authorization", `Bearer ${tenantA.token}`)
      .send({ name: "Video" })
      .expect(404);

    await request(app)
      .delete(`/api/instruments/${instrumentB.id}`)
      .set("Authorization", `Bearer ${tenantA.token}`)
      .expect(404);

    const updated = await request(app)
      .patch(`/api/instruments/${instrumentA.id}`)
      .set("Authorization", `Bearer ${tenantA.token}`)
      .send({ name: "Audio", colorHex: "#111827" })
      .expect(200);

    expect(updated.body.data).toMatchObject({ id: instrumentA.id, name: "Audio", colorHex: "#111827" });

    await request(app)
      .delete(`/api/instruments/${instrumentA.id}`)
      .set("Authorization", `Bearer ${tenantA.token}`)
      .expect(200);

    await request(app)
      .get("/api/instruments")
      .set("Authorization", `Bearer ${tenantA.token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toEqual([]);
      });
  });

  it("suporta múltiplos instrumentos por usuário, múltiplos usuários por instrumento e não duplica vínculos", async () => {
    const tenant = await registerTenant("instrument-cardinality");
    const memberA = await createMember(tenant.token, "instrument-card-a");
    const memberB = await createMember(tenant.token, "instrument-card-b");
    const keyboard = await createInstrument(tenant.token, "Teclado");
    const vocal = await createInstrument(tenant.token, "Vocal");

    await request(app)
      .patch(`/api/members/${memberA.user.id}/instruments`)
      .set("Authorization", `Bearer ${memberA.token}`)
      .send({ instrumentIds: [keyboard.id, vocal.id, keyboard.id] })
      .expect(200)
      .expect((response) => {
        expect(response.body.data.instruments).toHaveLength(2);
      });

    await request(app)
      .patch(`/api/members/${memberB.user.id}/instruments`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ instrumentIds: [keyboard.id] })
      .expect(200);

    expect(await prisma.userInstrument.count({ where: { userId: memberA.user.id } })).toBe(2);
    expect(await prisma.userInstrument.count({ where: { instrumentId: keyboard.id } })).toBe(2);
  });
});
