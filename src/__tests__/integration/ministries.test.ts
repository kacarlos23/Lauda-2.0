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
  await prisma.memberInvite.deleteMany();
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

async function createMember(token: string, seed: string, name = `Membro ${seed}`) {
  const response = await request(app)
    .post("/api/members")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name,
      email: `${seed}@example.com`,
      password: "secretpassword",
      role: "MEMBER",
    })
    .expect(201);

  return response.body.data;
}

async function createMinistry(token: string, name: string) {
  const response = await request(app)
    .post("/api/ministries")
    .set("Authorization", `Bearer ${token}`)
    .send({ name })
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
  it("GET /api/ministries › deve retornar apenas ministérios do próprio tenant", async () => {
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

  it("POST /api/ministries › deve ser bloqueado para usuários com role MEMBER", async () => {
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
    expect(res.body.error).toBe("Apenas administradores podem gerenciar ministérios");
  });

  it("PUT e DELETE /api/ministries permitem CRUD completo para admin do tenant", async () => {
    const tenant = await registerTenant("tenant-crud-ministry");

    const created = await request(app)
      .post("/api/ministries")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ name: "Diaconia", description: "Equipe inicial" })
      .expect(201);

    const updated = await request(app)
      .put(`/api/ministries/${created.body.data.id}`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ name: "Diaconia e Apoio", description: "Equipe de recepcao e apoio" })
      .expect(200);

    expect(updated.body.data).toMatchObject({
      id: created.body.data.id,
      name: "Diaconia e Apoio",
      description: "Equipe de recepcao e apoio",
      tenantId: tenant.user.tenantId,
    });

    await request(app)
      .delete(`/api/ministries/${created.body.data.id}`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .expect(200);

    await request(app)
      .get(`/api/ministries/${created.body.data.id}`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .expect(404);
  });

  it("POST /api/ministries/:id/members › deve validar RBAC e adicionar/remover membro", async () => {
    const tenantA = await registerTenant("tenant-rbac-test");

    // Cria o ministério
    const minRes = await request(app)
      .post("/api/ministries")
      .set("Authorization", `Bearer ${tenantA.token}`)
      .send({ name: "Louvor" })
      .expect(201);
    
    const ministryId = minRes.body.data.id;

    // Cria 2 membros: um que será lider e outro comum
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

    // Admin adiciona Leader como lider
    await request(app)
      .post(`/api/ministries/${ministryId}/members`)
      .set("Authorization", `Bearer ${tenantA.token}`)
      .send({ userId: leaderId, isLeader: true })
      .expect(201);

    // Leader adiciona User2 (deve funcionar pq Leader é lider)
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

  it("GET /api/ministries retorna para MEMBER apenas seus ministerios e seus respectivos membros", async () => {
    const tenant = await registerTenant("tenant-member-visible-ministries");

    const louvor = await request(app)
      .post("/api/ministries")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ name: "Louvor Visivel" })
      .expect(201);

    const recepcao = await request(app)
      .post("/api/ministries")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ name: "Recepcao Oculta" })
      .expect(201);

    await request(app)
      .post("/api/members")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ name: "Membro Vinculado", email: "member-visible@example.com", password: "secretpassword", role: "MEMBER" })
      .expect(201);

    await request(app)
      .post("/api/members")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ name: "Colega Louvor", email: "colleague-visible@example.com", password: "secretpassword", role: "MEMBER" })
      .expect(201);

    await request(app)
      .post("/api/members")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ name: "Outro Ministerio", email: "other-ministry@example.com", password: "secretpassword", role: "MEMBER" })
      .expect(201);

    const memberLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "member-visible@example.com", password: "secretpassword" })
      .expect(200);
    const colleagueLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "colleague-visible@example.com", password: "secretpassword" })
      .expect(200);
    const otherLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "other-ministry@example.com", password: "secretpassword" })
      .expect(200);

    await request(app)
      .post(`/api/ministries/${louvor.body.data.id}/members`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ userId: memberLogin.body.data.user.id, isLeader: false })
      .expect(201);

    await request(app)
      .post(`/api/ministries/${louvor.body.data.id}/members`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ userId: colleagueLogin.body.data.user.id, isLeader: false })
      .expect(201);

    await request(app)
      .post(`/api/ministries/${recepcao.body.data.id}/members`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ userId: otherLogin.body.data.user.id, isLeader: false })
      .expect(201);

    const memberMinistries = await request(app)
      .get("/api/ministries")
      .set("Authorization", `Bearer ${memberLogin.body.data.token}`)
      .expect(200);

    expect(memberMinistries.body.data.map((item: { name: string }) => item.name)).toEqual(["Louvor Visivel"]);

    const visibleDetail = await request(app)
      .get(`/api/ministries/${louvor.body.data.id}`)
      .set("Authorization", `Bearer ${memberLogin.body.data.token}`)
      .expect(200);

    expect(visibleDetail.body.data.members.map((item: { user: { email: string } }) => item.user.email)).toEqual([
      "colleague-visible@example.com",
      "member-visible@example.com",
    ]);

    await request(app)
      .get(`/api/ministries/${recepcao.body.data.id}`)
      .set("Authorization", `Bearer ${memberLogin.body.data.token}`)
      .expect(404);
  });

  it("POST /api/ministries/:id/toggle-member alterna vinculo sem duplicidade", async () => {
    const tenant = await registerTenant("toggle-link-unlink");
    const ministry = await createMinistry(tenant.token, "Louvor Toggle");
    const member = await createMember(tenant.token, "toggle-member", "Ana Toggle");

    const linked = await request(app)
      .post(`/api/ministries/${ministry.id}/toggle-member`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ member_id: member.id })
      .expect(200);

    expect(linked.body.data).toEqual({
      status: "linked",
      member_id: member.id,
      ministry_id: ministry.id,
    });

    await request(app)
      .post(`/api/ministries/${ministry.id}/toggle-member`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ member_id: member.id })
      .expect(200)
      .expect((response) => {
        expect(response.body.data.status).toBe("unlinked");
      });

    await request(app)
      .post(`/api/ministries/${ministry.id}/toggle-member`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ member_id: member.id })
      .expect(200)
      .expect((response) => {
        expect(response.body.data.status).toBe("linked");
      });

    expect(await prisma.ministryMember.count({ where: { userId: member.id, ministryId: ministry.id } })).toBe(1);
  });

  it("POST /api/ministries/:id/toggle-member aceita payload camelCase do app", async () => {
    const tenant = await registerTenant("toggle-camel-case");
    const ministry = await createMinistry(tenant.token, "Payload Camel");
    const member = await createMember(tenant.token, "toggle-camel-member", "Camel Toggle");

    await request(app)
      .post(`/api/ministries/${ministry.id}/toggle-member`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ memberId: member.id })
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          status: "linked",
          member_id: member.id,
          ministry_id: ministry.id,
        });
      });
  });

  it("POST /api/ministries/:id/toggle-member exige admin autenticado", async () => {
    const tenant = await registerTenant("toggle-permission");
    const ministry = await createMinistry(tenant.token, "Permissao Toggle");
    const member = await createMember(tenant.token, "toggle-common", "Comum Toggle");

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "toggle-common@example.com", password: "secretpassword" })
      .expect(200);

    await request(app)
      .post(`/api/ministries/${ministry.id}/toggle-member`)
      .send({ member_id: member.id })
      .expect(401);

    await request(app)
      .post(`/api/ministries/${ministry.id}/toggle-member`)
      .set("Authorization", `Bearer ${login.body.data.token}`)
      .send({ member_id: member.id })
      .expect(403);
  });

  it("POST /api/ministries/:id/toggle-member bloqueia acesso entre tenants", async () => {
    const tenantA = await registerTenant("toggle-tenant-a");
    const tenantB = await registerTenant("toggle-tenant-b");
    const ministryA = await createMinistry(tenantA.token, "Tenant A Toggle");
    const ministryB = await createMinistry(tenantB.token, "Tenant B Toggle");
    const memberA = await createMember(tenantA.token, "tenant-a-toggle-member", "Membro Tenant A");
    const memberB = await createMember(tenantB.token, "tenant-b-toggle-member", "Membro Tenant B");

    await request(app)
      .post(`/api/ministries/${ministryA.id}/toggle-member`)
      .set("Authorization", `Bearer ${tenantB.token}`)
      .send({ member_id: memberB.id })
      .expect(404);

    await request(app)
      .post(`/api/ministries/${ministryA.id}/toggle-member`)
      .set("Authorization", `Bearer ${tenantA.token}`)
      .send({ member_id: memberB.id })
      .expect(404);

    await request(app)
      .post(`/api/ministries/${ministryB.id}/toggle-member`)
      .set("Authorization", `Bearer ${tenantB.token}`)
      .send({ member_id: memberB.id })
      .expect(200);

    expect(await prisma.ministryMember.count({ where: { userId: memberA.id, ministryId: ministryB.id } })).toBe(0);
  });

  it("POST /api/ministries/:id/toggle-member valida payload e membro inexistente", async () => {
    const tenant = await registerTenant("toggle-validation");
    const ministry = await createMinistry(tenant.token, "Validacao Toggle");

    await request(app)
      .post(`/api/ministries/${ministry.id}/toggle-member`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({})
      .expect(400);

    await request(app)
      .post(`/api/ministries/${ministry.id}/toggle-member`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ member_id: "00000000-0000-4000-8000-000000000000" })
      .expect(404);
  });

  it("relacao MinistryMember permite multiplos membros e membro em multiplos ministerios no mesmo tenant", async () => {
    const tenant = await registerTenant("toggle-model-cardinality");
    const louvor = await createMinistry(tenant.token, "Louvor Cardinalidade");
    const midia = await createMinistry(tenant.token, "Midia Cardinalidade");
    const ana = await createMember(tenant.token, "card-ana", "Ana Cardinalidade");
    const bruno = await createMember(tenant.token, "card-bruno", "Bruno Cardinalidade");

    await request(app)
      .post(`/api/ministries/${louvor.id}/toggle-member`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ member_id: ana.id })
      .expect(200);
    await request(app)
      .post(`/api/ministries/${louvor.id}/toggle-member`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ member_id: bruno.id })
      .expect(200);
    await request(app)
      .post(`/api/ministries/${midia.id}/toggle-member`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ member_id: ana.id })
      .expect(200);

    expect(await prisma.ministryMember.count({ where: { ministryId: louvor.id } })).toBe(2);
    expect(await prisma.ministryMember.count({ where: { userId: ana.id } })).toBe(2);
  });

  it("DELETE /api/ministries/:id remove ministerio existente com vinculos dependentes", async () => {
    const tenant = await registerTenant("delete-ministry-dependencies");
    const ministry = await createMinistry(tenant.token, "Ministerio com dependencias");
    const member = await createMember(tenant.token, "delete-dependency-member", "Membro Dependencia");

    await request(app)
      .post(`/api/ministries/${ministry.id}/toggle-member`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({ member_id: member.id })
      .expect(200);

    const schedule = await prisma.schedule.create({
      data: {
        title: "Escala dependente",
        date: new Date("2026-06-01T10:00:00.000Z"),
        tenantId: tenant.user.tenantId,
        ministryId: ministry.id,
      },
    });
    await prisma.scheduleAssignment.create({
      data: {
        scheduleId: schedule.id,
        userId: member.id,
        role: "Vocal",
        tenantId: tenant.user.tenantId,
      },
    });
    await prisma.memberInvite.create({
      data: {
        tenantId: tenant.user.tenantId,
        ministryId: ministry.id,
        code: "delete-dependency-code",
      },
    });

    await request(app)
      .delete(`/api/ministries/${ministry.id}`)
      .set("Authorization", `Bearer ${tenant.token}`)
      .expect(200);

    expect(await prisma.ministry.findUnique({ where: { id: ministry.id } })).toBeNull();
    expect(await prisma.ministryMember.count({ where: { ministryId: ministry.id } })).toBe(0);
    expect(await prisma.schedule.count({ where: { ministryId: ministry.id } })).toBe(0);
    expect(await prisma.scheduleAssignment.count({ where: { scheduleId: schedule.id } })).toBe(0);
    expect(await prisma.memberInvite.count({ where: { ministryId: ministry.id } })).toBe(0);
  });
});
