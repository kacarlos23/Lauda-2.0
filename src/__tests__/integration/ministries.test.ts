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
  await prisma.scheduleAssignment.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.ministryMember.deleteMany();
  await prisma.ministrySong.deleteMany();
  await prisma.song.deleteMany();
  await prisma.ministry.deleteMany();
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

beforeAll(async () => {
  container = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({
      POSTGRES_DB: "lauda_test",
      POSTGRES_USER: "test",
      POSTGRES_PASSWORD: "test",
    })
    .withExposedPorts(5432)
    .start();

  const databaseUrl = `postgresql://test:test@${container.getHost()}:${container.getMappedPort(5432)}/lauda_test`;
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET = "test_access_secret";
  process.env.REFRESH_JWT_SECRET = "test_refresh_secret";
  process.env.NODE_ENV = "test";

  migrate(databaseUrl);

  const appModule = await import("../../app");
  const prismaModule = await import("../../config/prisma");
  app = appModule.default;
  prisma = prismaModule.prisma;
}, 60000);

afterAll(async () => {
  if (prisma) {
    await cleanDatabase();
    await prisma.$disconnect();
  }
  if (container) {
    await container.stop();
  }
});

describe("Ministries API - Isolamento Multi-Tenant", () => {
  it("GET /api/ministries â€º deve retornar apenas ministérios do próprio tenant", async () => {
    // Registra Tenant A e Tenant B
    const tenantA = await registerTenant("tenant-a-min");
    const tenantB = await registerTenant("tenant-b-min");

    // Cria ministério para o Tenant A usando o token dele
    await request(app)
      .post("/api/ministries")
      .set("Authorization", `Bearer ${tenantA.token}`)
      .send({ name: "Ministry A1" })
      .expect(201);

    // Cria ministério para o Tenant B usando o token dele
    await request(app)
      .post("/api/ministries")
      .set("Authorization", `Bearer ${tenantB.token}`)
      .send({ name: "Ministry B1" })
      .expect(201);

    // Request as Tenant A
    const resA = await request(app)
      .get("/api/ministries")
      .set("Authorization", `Bearer ${tenantA.token}`);

    expect(resA.status).toBe(200);
    expect(resA.body.data).toHaveLength(1);
    expect(resA.body.data[0].name).toBe("Ministry A1");

    // Request as Tenant B
    const resB = await request(app)
      .get("/api/ministries")
      .set("Authorization", `Bearer ${tenantB.token}`);

    expect(resB.status).toBe(200);
    expect(resB.body.data).toHaveLength(1);
    expect(resB.body.data[0].name).toBe("Ministry B1");
  });

  it("POST /api/ministries â€º deve ser bloqueado para usuários com role MEMBER", async () => {
    const tenantA = await registerTenant("tenant-member-test");

    // Cria um membro comum usando o token de admin
    await request(app)
      .post("/api/members")
      .set("Authorization", `Bearer ${tenantA.token}`)
      .send({
        name: "Common Member",
        email: "common@example.com",
        password: "secretpassword",
        role: "MEMBER"
      })
      .expect(201);

    // Faz login com o membro comum
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({
        email: "common@example.com",
        password: "secretpassword",
      })
      .expect(200);

    const memberToken = loginRes.body.data.token;

    // Tenta criar um ministério com a role MEMBER
    const res = await request(app)
      .post("/api/ministries")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ name: "Hacked Ministry" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Apenas administradores podem criar ministérios");
  });

  it("POST /api/ministries/:id/members â€º deve validar RBAC e adicionar/remover membro", async () => {
    const tenantA = await registerTenant("tenant-rbac-test");

    // Cria o ministério
    const minRes = await request(app)
      .post("/api/ministries")
      .set("Authorization", `Bearer ${tenantA.token}`)
      .send({ name: "Louvor" })
      .expect(201);
    
    const ministryId = minRes.body.data.id;

    // Cria 2 membros: um que será líder e outro comum
    await request(app).post("/api/members").set("Authorization", `Bearer ${tenantA.token}`).send({ name: "Leader", email: "leader@example.com", password: "secretpassword", role: "MEMBER" }).expect(201);
    await request(app).post("/api/members").set("Authorization", `Bearer ${tenantA.token}`).send({ name: "User2", email: "user2@example.com", password: "secretpassword", role: "MEMBER" }).expect(201);

    const leaderLogin = await request(app).post("/api/auth/login").send({ email: "leader@example.com", password: "secretpassword" }).expect(200);
    const leaderToken = leaderLogin.body.data.token;
    const leaderId = leaderLogin.body.data.user.id;

    const user2Login = await request(app).post("/api/auth/login").send({ email: "user2@example.com", password: "secretpassword" }).expect(200);
    const user2Token = user2Login.body.data.token;
    const user2Id = user2Login.body.data.user.id;

    // User2 tenta se adicionar ao ministério (deve falhar pq não é líder nem admin)
    const failRes = await request(app)
      .post(`/api/ministries/${ministryId}/members`)
      .set("Authorization", `Bearer ${user2Token}`)
      .send({ userId: user2Id, isLeader: false });
    
    expect(failRes.status).toBe(403);
    expect(failRes.body.error).toBe("Apenas o líder do ministério ou administradores podem gerenciar membros");

    // Admin adiciona Leader como líder
    await request(app)
      .post(`/api/ministries/${ministryId}/members`)
      .set("Authorization", `Bearer ${tenantA.token}`)
      .send({ userId: leaderId, isLeader: true })
      .expect(201);

    // Leader adiciona User2 (deve funcionar pq Leader é líder)
    await request(app)
      .post(`/api/ministries/${ministryId}/members`)
      .set("Authorization", `Bearer ${leaderToken}`)
      .send({ userId: user2Id, isLeader: false })
      .expect(201);

    // Leader remove User2
    await request(app)
      .delete(`/api/ministries/${ministryId}/members/${user2Id}`)
      .set("Authorization", `Bearer ${leaderToken}`)
      .expect(200);
  });
});
