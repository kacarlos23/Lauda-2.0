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

async function createMember(token: string, email: string) {
  const response = await request(app)
    .post("/api/members")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Novo Membro",
      email,
      phone: "(11) 99999-0000",
      password: "member123",
      role: "MEMBER",
    });

  return response;
}

function createMemberWithRole(token: string, email: string, role: "MEMBER" | "MINISTRY_LEADER") {
  return request(app)
    .post("/api/members")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: `Usuario ${role}`,
      email,
      password: "member123",
      role,
    });
}

function expectInvitePayload(data: Record<string, unknown>) {
  expect(data).toMatchObject({
    id: expect.any(String),
    code: expect.any(String),
    active: true,
    expiresAt: null,
    createdAt: expect.any(String),
    inviteLink: expect.any(String),
  });
  expect(data.inviteLink).toBe(`lauda://member-register?code=${data.code}`);
  expect(String(data.code)).toMatch(/^[A-Za-z0-9_-]+$/);
}

beforeAll(async () => {
  container = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({
      POSTGRES_DB: "lauda_members_test",
      POSTGRES_USER: "test",
      POSTGRES_PASSWORD: "test",
    })
    .withExposedPorts(5432)
    .start();

  const databaseUrl = `postgresql://test:test@${container.getHost()}:${container.getMappedPort(5432)}/lauda_members_test`;
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET = "test_access_secret";
  process.env.REFRESH_JWT_SECRET = "test_refresh_secret";
  process.env.JWT_EXPIRES_IN = "15m";
  process.env.REFRESH_JWT_EXPIRES_IN = "7d";
  process.env.MEMBER_INVITE_BASE_URL = "lauda://member-register";
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

describe("Members API", () => {
  it("POST /api/members cadastra membro sem retornar senha", async () => {
    const tenant = await registerTenant("members-create");

    const response = await createMember(tenant.token, "member-create@example.com");

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      name: "Novo Membro",
      email: "member-create@example.com",
      phone: "(11) 99999-0000",
      role: "MEMBER",
    });
    expect(response.body.data.password).toBeUndefined();

    const stored = await prisma.user.findUnique({ where: { email: "member-create@example.com" } });
    expect(stored?.password).not.toBe("member123");
    expect(stored?.tenantId).toBe(tenant.user.tenantId);
  });

  it("bloqueia cadastro de membro por usuario sem permissao", async () => {
    const tenant = await registerTenant("members-forbidden");
    await createMember(tenant.token, "common-forbidden@example.com");

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "common-forbidden@example.com", password: "member123" })
      .expect(200);

    const response = await request(app)
      .post("/api/members")
      .set("Authorization", `Bearer ${login.body.data.token}`)
      .send({
        name: "Tentativa",
        email: "blocked@example.com",
        password: "member123",
        role: "MEMBER",
      });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      error: "Acesso negado: apenas administradores",
    });
  });

  it("retorna erro amigavel para email duplicado", async () => {
    const tenant = await registerTenant("members-duplicate");
    await createMember(tenant.token, "duplicate@example.com");

    const response = await createMember(tenant.token, "duplicate@example.com");

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Já existe um usuário com este e-mail");
  });

  it("lista apenas membros do tenant autenticado", async () => {
    const tenantA = await registerTenant("members-tenant-a");
    const tenantB = await registerTenant("members-tenant-b");

    await createMember(tenantA.token, "tenant-a-member@example.com");
    await createMember(tenantB.token, "tenant-b-member@example.com");

    const response = await request(app)
      .get("/api/members")
      .set("Authorization", `Bearer ${tenantA.token}`)
      .expect(200);

    const emails = response.body.data.map((member: { email: string }) => member.email);
    expect(emails).toContain("tenant-a-member@example.com");
    expect(emails).not.toContain("tenant-b-member@example.com");
  });

  it("permite login do usuario recem-criado", async () => {
    const tenant = await registerTenant("members-login");
    await createMember(tenant.token, "login-member@example.com");

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "login-member@example.com", password: "member123" });

    expect(response.status).toBe(200);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.user).toMatchObject({
      email: "login-member@example.com",
      role: "MEMBER",
      tenantId: tenant.user.tenantId,
    });
  });

  it("admin obtem convite e GET cria um quando nao existe ativo", async () => {
    const tenant = await registerTenant("invite-get-create");

    expect(await prisma.memberInvite.count()).toBe(0);

    const response = await request(app)
      .get("/api/auth/member-invite")
      .set("Authorization", `Bearer ${tenant.token}`)
      .expect(200);

    expectInvitePayload(response.body.data);
    expect(await prisma.memberInvite.count()).toBe(1);
  });

  it("admin regenera convite e desativa o convite anterior", async () => {
    const tenant = await registerTenant("invite-regenerate");

    const first = await request(app)
      .get("/api/auth/member-invite")
      .set("Authorization", `Bearer ${tenant.token}`)
      .expect(200);

    const second = await request(app)
      .post("/api/auth/member-invite/regenerate")
      .set("Authorization", `Bearer ${tenant.token}`)
      .expect(201);

    expectInvitePayload(second.body.data);
    expect(second.body.data.code).not.toBe(first.body.data.code);

    const oldInvite = await prisma.memberInvite.findUnique({ where: { code: first.body.data.code } });
    expect(oldInvite?.active).toBe(false);
  });

  it("POST /api/auth/member-register cadastra membro publico com convite valido", async () => {
    const tenant = await registerTenant("public-member-valid");
    const invite = await request(app)
      .get("/api/auth/member-invite")
      .set("Authorization", `Bearer ${tenant.token}`)
      .expect(200);
    expectInvitePayload(invite.body.data);

    const response = await request(app)
      .post("/api/auth/member-register")
      .send({
        inviteCode: invite.body.data.code,
        name: "Membro Publico",
        email: "public-valid@example.com",
        phone: "(21) 99999-0000",
        password: "public123",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).toEqual(expect.any(String));
    expect(response.body.data.user).toMatchObject({
      name: "Membro Publico",
      email: "public-valid@example.com",
      role: "MEMBER",
      tenantId: tenant.user.tenantId,
    });
    expect(response.body.data.user.password).toBeUndefined();
  });

  it("POST /api/auth/member-register rejeita convite invalido", async () => {
    const response = await request(app)
      .post("/api/auth/member-register")
      .send({
        inviteCode: "invalid-public-code",
        name: "Membro Publico",
        email: "public-invalid@example.com",
        password: "public123",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Convite invalido ou expirado");
  });

  it("POST /api/auth/member-register bloqueia email duplicado", async () => {
    const tenant = await registerTenant("public-member-duplicate");
    const invite = await request(app)
      .get("/api/auth/member-invite")
      .set("Authorization", `Bearer ${tenant.token}`)
      .expect(200);

    await request(app)
      .post("/api/auth/member-register")
      .send({
        inviteCode: invite.body.data.code,
        name: "Membro Um",
        email: "public-duplicate@example.com",
        password: "public123",
      })
      .expect(201);

    const response = await request(app)
      .post("/api/auth/member-register")
      .send({
        inviteCode: invite.body.data.code,
        name: "Membro Dois",
        email: "public-duplicate@example.com",
        password: "public123",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("E-mail ja esta em uso");
  });

  it("cadastro publico ignora role e cria sempre MEMBER sem criar tenant", async () => {
    const tenant = await registerTenant("public-member-role");
    const tenantCountBefore = await prisma.tenant.count();
    const invite = await request(app)
      .get("/api/auth/member-invite")
      .set("Authorization", `Bearer ${tenant.token}`)
      .expect(200);

    const response = await request(app)
      .post("/api/auth/member-register")
      .send({
        inviteCode: invite.body.data.code,
        name: "Tentativa Admin",
        email: "public-role@example.com",
        password: "public123",
        role: "TENANT_ADMIN",
        churchName: "Igreja Injetada",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBe("MEMBER");
    expect(await prisma.tenant.count()).toBe(tenantCountBefore);

    const stored = await prisma.user.findUnique({ where: { email: "public-role@example.com" } });
    expect(stored?.role).toBe("MEMBER");
    expect(stored?.tenantId).toBe(tenant.user.tenantId);
  });

  it("cadastro publico retorna tokens que permitem acessar area logada", async () => {
    const tenant = await registerTenant("public-member-token");
    const invite = await request(app)
      .get("/api/auth/member-invite")
      .set("Authorization", `Bearer ${tenant.token}`)
      .expect(200);

    const register = await request(app)
      .post("/api/auth/member-register")
      .send({
        inviteCode: invite.body.data.code,
        name: "Membro Token",
        email: "public-token@example.com",
        password: "public123",
      })
      .expect(201);

    await request(app)
      .get("/api/ministries")
      .set("Authorization", `Bearer ${register.body.data.token}`)
      .expect(200);
  });

  it("endpoint de convite exige admin e regeneracao invalida codigo anterior", async () => {
    const tenant = await registerTenant("public-member-admin");
    await createMemberWithRole(tenant.token, "invite-common@example.com", "MEMBER").expect(201);
    await createMemberWithRole(tenant.token, "invite-leader@example.com", "MINISTRY_LEADER").expect(201);

    const memberLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "invite-common@example.com", password: "member123" })
      .expect(200);
    const leaderLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "invite-leader@example.com", password: "member123" })
      .expect(200);

    await request(app)
      .get("/api/auth/member-invite")
      .set("Authorization", `Bearer ${memberLogin.body.data.token}`)
      .expect(403);

    await request(app)
      .post("/api/auth/member-invite/regenerate")
      .set("Authorization", `Bearer ${memberLogin.body.data.token}`)
      .expect(403);

    await request(app)
      .get("/api/auth/member-invite")
      .set("Authorization", `Bearer ${leaderLogin.body.data.token}`)
      .expect(403);

    await request(app)
      .post("/api/auth/member-invite/regenerate")
      .set("Authorization", `Bearer ${leaderLogin.body.data.token}`)
      .expect(403);

    const first = await request(app)
      .get("/api/auth/member-invite")
      .set("Authorization", `Bearer ${tenant.token}`)
      .expect(200);
    expectInvitePayload(first.body.data);

    const second = await request(app)
      .post("/api/auth/member-invite/regenerate")
      .set("Authorization", `Bearer ${tenant.token}`)
      .expect(201);
    expectInvitePayload(second.body.data);

    expect(second.body.data.code).not.toBe(first.body.data.code);

    await request(app)
      .post("/api/auth/member-register")
      .send({
        inviteCode: first.body.data.code,
        name: "Codigo Antigo",
        email: "old-code@example.com",
        password: "public123",
      })
      .expect(400);

    const newInviteRegister = await request(app)
      .post("/api/auth/member-register")
      .send({
        inviteCode: second.body.data.code,
        name: "Codigo Novo",
        email: "new-code@example.com",
        password: "public123",
      })
      .expect(201);

    expect(newInviteRegister.body.data.user).toMatchObject({
      email: "new-code@example.com",
      role: "MEMBER",
      tenantId: tenant.user.tenantId,
    });
  });
});
