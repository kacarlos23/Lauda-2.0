import { execFileSync } from "node:child_process";
import path from "node:path";
import crypto from "node:crypto";
import type express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { GenericContainer, StartedTestContainer } from "testcontainers";
import { DEFAULT_INSTRUMENTS } from "../../constants/defaultInstruments";
import type { prisma as PrismaClientInstance } from "../../config/prisma";

let app: express.Express;
let prisma: typeof PrismaClientInstance;
let container: StartedTestContainer;
const TEST_ACCESS_SECRET = "test_access_secret";
const TEST_REFRESH_SECRET = "test_refresh_secret";

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

async function registerTenant(seed: string): Promise<void> {
  await request(app)
    .post("/api/auth/register")
    .send({
      churchName: `Igreja ${seed}`,
      name: `Admin ${seed}`,
      email: `admin-${seed}@example.com`,
      password: "secret123",
    })
    .expect(201);
}

beforeAll(async () => {
  container = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({
      POSTGRES_DB: "lauda_auth_test",
      POSTGRES_USER: "test",
      POSTGRES_PASSWORD: "test",
    })
    .withExposedPorts(5432)
    .start();

  const databaseUrl = `postgresql://test:test@${container.getHost()}:${container.getMappedPort(5432)}/lauda_auth_test`;
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET = TEST_ACCESS_SECRET;
  process.env.REFRESH_JWT_SECRET = TEST_REFRESH_SECRET;
  process.env.PASSWORD_RESET_PEPPER = "test-password-reset-pepper-that-is-long-enough";
  process.env.PASSWORD_RESET_TEST_PIN = "123456";
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

afterEach(() => {
  jest.restoreAllMocks();
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

describe("Auth API", () => {
  it("POST /api/auth/login returns tokens and authenticated user for valid credentials", async () => {
    await registerTenant("auth-valid");

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "admin-auth-valid@example.com",
        password: "secret123",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).toEqual(expect.any(String));
    expect(response.body.data.user.role).toBe("TENANT_ADMIN");
    expect(response.body.data.user.tenantId).toEqual(expect.any(String));
  });

  it("POST /api/auth/register pre-cadastra os instrumentos padrão da igreja", async () => {
    await registerTenant("auth-default-instruments");

    const instruments = await prisma.instrument.findMany({
      select: { name: true, colorHex: true },
      orderBy: { name: "asc" },
    });

    expect(instruments).toHaveLength(DEFAULT_INSTRUMENTS.length);
    expect(instruments.map((instrument) => instrument.name).sort()).toEqual(
      DEFAULT_INSTRUMENTS.map((instrument) => instrument.name).sort()
    );
  });

  it("POST /api/auth/login returns 401 for wrong password", async () => {
    await registerTenant("auth-wrong-password");

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "admin-auth-wrong-password@example.com",
        password: "wrong123",
      });

    expect(response.status).toBe(401);
  });

  it("POST /api/auth/login does not disclose whether the e-mail exists", async () => {
    await registerTenant("auth-enumeration");
    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({
        email: "admin-auth-enumeration@example.com",
        password: "wrong123",
      });
    const missingUser = await request(app)
      .post("/api/auth/login")
      .send({
        email: "missing@example.com",
        password: "secret123",
      });

    expect(missingUser.status).toBe(401);
    expect(missingUser.body).toEqual(wrongPassword.body);
  });

  it("login emite role GLOBAL_ADMIN no usuário, JWT e middleware permite /api/admin/tenants", async () => {
    await registerTenant("auth-global-admin");
    const storedUser = await prisma.user.update({
      where: { email: "admin-auth-global-admin@example.com" },
      data: { role: Role.GLOBAL_ADMIN },
      select: { id: true, role: true },
    });

    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        email: "admin-auth-global-admin@example.com",
        password: "secret123",
      })
      .expect(200);

    const accessToken = loginResponse.body.data.accessToken as string;
    expect(loginResponse.body.data.user.role).toBe(Role.GLOBAL_ADMIN);
    expect(jwt.decode(accessToken)).toMatchObject({ userId: storedUser.id, role: Role.GLOBAL_ADMIN });

    await request(app).get("/api/admin/tenants").set("Authorization", `Bearer ${accessToken}`).expect(200);
  });

  it("aplica promoção e rebaixamento atuais do banco a tokens já emitidos", async () => {
    await registerTenant("auth-role-refresh");

    const oldLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: "admin-auth-role-refresh@example.com",
        password: "secret123",
      })
      .expect(200);
    expect(oldLogin.body.data.user.role).toBe(Role.TENANT_ADMIN);

    await prisma.user.update({
      where: { email: "admin-auth-role-refresh@example.com" },
      data: { role: Role.GLOBAL_ADMIN },
    });

    await request(app)
      .get("/api/admin/tenants")
      .set("Authorization", `Bearer ${oldLogin.body.data.accessToken}`)
      .expect(200);

    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: "admin-auth-role-refresh@example.com",
        password: "secret123",
      })
      .expect(200);

    expect(newLogin.body.data.user.role).toBe(Role.GLOBAL_ADMIN);
    expect(jwt.decode(newLogin.body.data.accessToken)).toMatchObject({ role: Role.GLOBAL_ADMIN });
    await request(app)
      .get("/api/admin/tenants")
      .set("Authorization", `Bearer ${newLogin.body.data.accessToken}`)
      .expect(200);

    await prisma.user.update({
      where: { email: "admin-auth-role-refresh@example.com" },
      data: { role: Role.TENANT_ADMIN },
    });
    await request(app)
      .get("/api/admin/tenants")
      .set("Authorization", `Bearer ${newLogin.body.data.accessToken}`)
      .expect(403);
  });

  it("ignora role e tenantId do JWT para autorização", async () => {
    await registerTenant("auth-current-user-a");
    await registerTenant("auth-current-user-b");

    const [userA, userB] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { email: "admin-auth-current-user-a@example.com" },
        select: { id: true, role: true, tenantId: true },
      }),
      prisma.user.findUniqueOrThrow({
        where: { email: "admin-auth-current-user-b@example.com" },
        select: { tenantId: true },
      }),
    ]);
    const validLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin-auth-current-user-a@example.com", password: "secret123" })
      .expect(200);
    const validClaims = jwt.decode(validLogin.body.data.accessToken) as jwt.JwtPayload;

    const tokenWithStaleClaims = jwt.sign(
      {
        type: "access",
        userId: userA.id,
        sid: validClaims.sid,
        email: "admin-auth-current-user-a@example.com",
        role: Role.GLOBAL_ADMIN,
        tenantId: userB.tenantId,
      },
      TEST_ACCESS_SECRET,
      {
        algorithm: "HS256",
        expiresIn: "15m",
        issuer: "lauda-api",
        audience: "lauda-clients",
        subject: userA.id,
        jwtid: crypto.randomUUID(),
      },
    );

    await request(app)
      .get("/api/admin/tenants")
      .set("Authorization", `Bearer ${tokenWithStaleClaims}`)
      .expect(403);

    const church = await request(app)
      .get("/api/church/me")
      .set("Authorization", `Bearer ${tokenWithStaleClaims}`)
      .expect(200);

    expect(userA.role).toBe(Role.TENANT_ADMIN);
    expect(church.body.data.tenant.id).toBe(userA.tenantId);
    expect(church.body.data.tenant.id).not.toBe(userB.tenantId);
  });

  it("nega login, refresh e Bearer quando o usuário atual está inativo", async () => {
    await registerTenant("auth-inactive-current-user");
    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin-auth-inactive-current-user@example.com", password: "secret123" })
      .expect(200);

    await prisma.user.update({
      where: { email: "admin-auth-inactive-current-user@example.com" },
      data: { isActive: false },
    });

    await request(app)
      .post("/api/auth/login")
      .send({ email: "admin-auth-inactive-current-user@example.com", password: "secret123" })
      .expect(401);
    await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: loginResponse.body.data.refreshToken })
      .expect(401);
    await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginResponse.body.data.accessToken}`)
      .expect(401);
  });

  it("nega usuário não-global sem tenant atual no banco", async () => {
    await registerTenant("auth-missing-current-tenant");
    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin-auth-missing-current-tenant@example.com", password: "secret123" })
      .expect(200);

    await prisma.user.update({
      where: { email: "admin-auth-missing-current-tenant@example.com" },
      data: { tenantId: null },
    });

    await request(app)
      .post("/api/auth/login")
      .send({ email: "admin-auth-missing-current-tenant@example.com", password: "secret123" })
      .expect(401);
    await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: loginResponse.body.data.refreshToken })
      .expect(401);
    await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginResponse.body.data.accessToken}`)
      .expect(401);
  });

  it("armazena somente HMAC do PIN e não registra o segredo", async () => {
    await registerTenant("password-reset-hmac");
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const errorLogSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "admin-password-reset-hmac@example.com" })
      .expect(200);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { email: "admin-password-reset-hmac@example.com" },
      select: {
        resetPasswordToken: true,
        resetPasswordChallengeId: true,
        resetPasswordPepperVersion: true,
        resetPasswordAttempts: true,
      },
    });

    expect(response.body.data.message).toContain("Se o e-mail existir");
    expect(stored.resetPasswordToken).toEqual(expect.any(String));
    expect(stored.resetPasswordToken).not.toBe("123456");
    expect(stored.resetPasswordChallengeId).toEqual(expect.any(String));
    expect(stored.resetPasswordPepperVersion).toBe(1);
    expect(stored.resetPasswordAttempts).toBe(0);
    await request(app)
      .post("/api/auth/reset-password")
      .send({
        email: "admin-password-reset-hmac@example.com",
        token: "123456",
        newPassword: "new-sensitive-password",
      })
      .expect(200);
    const serializedLogs = JSON.stringify([logSpy.mock.calls, errorLogSpy.mock.calls]);
    for (const sensitiveValue of [
      "123456",
      "new-sensitive-password",
      "admin-password-reset-hmac@example.com",
    ]) {
      expect(serializedLogs).not.toContain(sensitiveValue);
    }
  });

  it("consome o PIN uma única vez e atualiza a senha", async () => {
    await registerTenant("password-reset-consume");
    const email = "admin-password-reset-consume@example.com";
    await request(app).post("/api/auth/forgot-password").send({ email }).expect(200);

    await request(app)
      .post("/api/auth/reset-password")
      .send({ email, token: "123456", newPassword: "new-secret-123" })
      .expect(200);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: {
        resetPasswordToken: true,
        resetPasswordChallengeId: true,
        resetPasswordConsumedAt: true,
      },
    });
    expect(stored.resetPasswordToken).toBeNull();
    expect(stored.resetPasswordChallengeId).toBeNull();
    expect(stored.resetPasswordConsumedAt).toBeInstanceOf(Date);

    await request(app).post("/api/auth/login").send({ email, password: "secret123" }).expect(401);
    await request(app).post("/api/auth/login").send({ email, password: "new-secret-123" }).expect(200);
    await request(app)
      .post("/api/auth/reset-password")
      .send({ email, token: "123456", newPassword: "reused-secret" })
      .expect(400);
  });

  it("permite somente um consumo em duas requisições concorrentes", async () => {
    await registerTenant("password-reset-concurrent");
    const email = "admin-password-reset-concurrent@example.com";
    await request(app).post("/api/auth/forgot-password").send({ email }).expect(200);

    const responses = await Promise.all([
      request(app).post("/api/auth/reset-password").send({ email, token: "123456", newPassword: "concurrent-secret-a" }),
      request(app).post("/api/auth/reset-password").send({ email, token: "123456", newPassword: "concurrent-secret-b" }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 400]);
    const successfulPassword = responses[0].status === 200 ? "concurrent-secret-a" : "concurrent-secret-b";
    const rejectedPassword = responses[0].status === 200 ? "concurrent-secret-b" : "concurrent-secret-a";
    await request(app).post("/api/auth/login").send({ email, password: successfulPassword }).expect(200);
    await request(app).post("/api/auth/login").send({ email, password: rejectedPassword }).expect(401);
  });

  it("rejeita PIN expirado sem alterar a senha", async () => {
    await registerTenant("password-reset-expired");
    const email = "admin-password-reset-expired@example.com";
    await request(app).post("/api/auth/forgot-password").send({ email }).expect(200);
    await prisma.user.update({
      where: { email },
      data: { resetPasswordExpires: new Date(Date.now() - 1_000) },
    });

    await request(app)
      .post("/api/auth/reset-password")
      .send({ email, token: "123456", newPassword: "expired-secret" })
      .expect(400);
    await request(app).post("/api/auth/login").send({ email, password: "secret123" }).expect(200);
  });

  it("bloqueia o desafio após o limite de tentativas", async () => {
    await registerTenant("password-reset-attempts");
    const email = "admin-password-reset-attempts@example.com";
    await request(app).post("/api/auth/forgot-password").send({ email }).expect(200);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app)
        .post("/api/auth/reset-password")
        .send({ email, token: "000000", newPassword: "new-secret-123" })
        .expect(400);
    }

    await request(app)
      .post("/api/auth/reset-password")
      .send({ email, token: "123456", newPassword: "new-secret-123" })
      .expect(400);
    const stored = await prisma.user.findUniqueOrThrow({ where: { email }, select: { resetPasswordAttempts: true } });
    expect(stored.resetPasswordAttempts).toBe(5);
  });

  it("retorna resposta genérica para forgot-password de usuário inexistente", async () => {
    await registerTenant("password-reset-enumeration");
    const existing = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "admin-password-reset-enumeration@example.com" })
      .expect(200);
    const missing = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "missing-password-reset@example.com" })
      .expect(200);
    expect(existing.body.data.message).toBe("Se o e-mail existir, um código foi enviado.");
    expect(missing.body).toEqual(existing.body);
  });

  it("revoga login, refresh e Bearer quando o tenant é desativado", async () => {
    await registerTenant("inactive-tenant");
    const email = "admin-inactive-tenant@example.com";
    const login = await request(app).post("/api/auth/login").send({ email, password: "secret123" }).expect(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { tenantId: true } });
    await prisma.tenant.update({ where: { id: user.tenantId! }, data: { isActive: false } });

    await request(app).post("/api/auth/login").send({ email, password: "secret123" }).expect(401);
    await request(app).post("/api/auth/refresh").send({ refreshToken: login.body.data.refreshToken }).expect(401);
    await request(app).get("/api/auth/me").set("Authorization", `Bearer ${login.body.data.accessToken}`).expect(401);
  });

  it("revoga login, refresh e Bearer quando usuário ou tenant está excluído logicamente", async () => {
    await registerTenant("deleted-lifecycle");
    const email = "admin-deleted-lifecycle@example.com";
    const firstLogin = await request(app).post("/api/auth/login").send({ email, password: "secret123" }).expect(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, tenantId: true } });
    await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });

    await request(app).post("/api/auth/login").send({ email, password: "secret123" }).expect(401);
    await request(app).post("/api/auth/refresh").send({ refreshToken: firstLogin.body.data.refreshToken }).expect(401);
    await request(app).get("/api/auth/me").set("Authorization", `Bearer ${firstLogin.body.data.accessToken}`).expect(401);

    await prisma.user.update({ where: { id: user.id }, data: { deletedAt: null } });
    const secondLogin = await request(app).post("/api/auth/login").send({ email, password: "secret123" }).expect(200);
    await prisma.tenant.update({ where: { id: user.tenantId! }, data: { deletedAt: new Date() } });
    await request(app).post("/api/auth/refresh").send({ refreshToken: secondLogin.body.data.refreshToken }).expect(401);
    await request(app).get("/api/auth/me").set("Authorization", `Bearer ${secondLogin.body.data.accessToken}`).expect(401);
  });

  it("emite contrato inequívoco e persiste somente o hash do refresh", async () => {
    await registerTenant("session-contract");
    const login = await request(app)
      .post("/api/auth/login")
      .set("User-Agent", "lauda-contract-test")
      .send({ email: "admin-session-contract@example.com", password: "secret123" })
      .expect(200);

    const access = jwt.decode(login.body.data.accessToken) as jwt.JwtPayload;
    const refresh = jwt.decode(login.body.data.refreshToken) as jwt.JwtPayload;
    expect(access).toMatchObject({
      type: "access",
      iss: "lauda-api",
      aud: "lauda-clients",
      sid: expect.any(String),
      jti: expect.any(String),
    });
    expect(refresh).toMatchObject({
      type: "refresh",
      iss: "lauda-api",
      aud: "lauda-refresh",
      sid: access.sid,
      jti: expect.any(String),
    });
    expect(access.sub).toBe(refresh.sub);

    const stored = await prisma.refreshToken.findUniqueOrThrow({ where: { jti: refresh.jti! } });
    expect(stored.tokenHash).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(stored.tokenHash).not.toBe(login.body.data.refreshToken);
    const session = await prisma.authSession.findUniqueOrThrow({ where: { id: access.sid as string } });
    expect(session.userAgent).toBe("lauda-contract-test");
  });

  it("nunca aceita refresh como Bearer nem access no endpoint de refresh", async () => {
    await registerTenant("token-purpose");
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin-token-purpose@example.com", password: "secret123" })
      .expect(200);

    await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.data.refreshToken}`)
      .expect(401);
    await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: login.body.data.accessToken })
      .expect(401);
  });

  it.each([
    ["issuer", { issuer: "attacker" }],
    ["audience", { audience: "wrong-audience" }],
    ["type", { type: "access" }],
  ])("rejeita refresh com %s inválido", async (_case, rawOverride) => {
    const override = rawOverride as { issuer?: string; audience?: string; type?: string };
    await registerTenant(`invalid-${_case}`);
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: `admin-invalid-${_case}@example.com`, password: "secret123" })
      .expect(200);
    const valid = jwt.decode(login.body.data.refreshToken) as jwt.JwtPayload;
    const forged = jwt.sign(
      {
        userId: valid.userId,
        type: override.type ?? "refresh",
        sid: valid.sid,
      },
      TEST_REFRESH_SECRET,
      {
        algorithm: "HS256",
        expiresIn: "15m",
        issuer: override.issuer ?? "lauda-api",
        audience: override.audience ?? "lauda-refresh",
        subject: valid.sub,
        jwtid: crypto.randomUUID(),
      },
    );

    await request(app).post("/api/auth/refresh").send({ refreshToken: forged }).expect(401);
  });

  it("rejeita refresh com claim obrigatória ausente e algoritmo inesperado", async () => {
    await registerTenant("invalid-refresh-contract");
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin-invalid-refresh-contract@example.com", password: "secret123" })
      .expect(200);
    const valid = jwt.decode(login.body.data.refreshToken) as jwt.JwtPayload;
    const missingSid = jwt.sign(
      { userId: valid.userId, type: "refresh" },
      TEST_REFRESH_SECRET,
      { algorithm: "HS256", issuer: "lauda-api", audience: "lauda-refresh", jwtid: crypto.randomUUID(), expiresIn: "15m" },
    );
    const unexpectedAlgorithm = jwt.sign(
      { userId: valid.userId, type: "refresh", sid: valid.sid },
      TEST_REFRESH_SECRET,
      { algorithm: "HS384", issuer: "lauda-api", audience: "lauda-refresh", subject: valid.sub, jwtid: crypto.randomUUID(), expiresIn: "15m" },
    );

    await request(app).post("/api/auth/refresh").send({ refreshToken: missingSid }).expect(401);
    await request(app).post("/api/auth/refresh").send({ refreshToken: unexpectedAlgorithm }).expect(401);
  });

  it("rotaciona uma vez e reuse revoga toda a família", async () => {
    await registerTenant("refresh-reuse");
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin-refresh-reuse@example.com", password: "secret123" })
      .expect(200);
    const rotated = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: login.body.data.refreshToken })
      .expect(200);

    await request(app).post("/api/auth/refresh").send({ refreshToken: login.body.data.refreshToken }).expect(401);
    await request(app).post("/api/auth/refresh").send({ refreshToken: rotated.body.data.refreshToken }).expect(401);
  });

  it("resolve refresh concorrente sem deixar cadeia válida independente", async () => {
    await registerTenant("refresh-concurrent");
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin-refresh-concurrent@example.com", password: "secret123" })
      .expect(200);

    const responses = await Promise.all([
      request(app).post("/api/auth/refresh").send({ refreshToken: login.body.data.refreshToken }),
      request(app).post("/api/auth/refresh").send({ refreshToken: login.body.data.refreshToken }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 401]);
    const winner = responses.find((response) => response.status === 200)!;
    await request(app).post("/api/auth/refresh").send({ refreshToken: winner.body.data.refreshToken }).expect(401);
  });

  it("logout atual revoga somente sua sessão e logout global revoga todas", async () => {
    await registerTenant("logout-scope");
    const credentials = { email: "admin-logout-scope@example.com", password: "secret123" };
    const first = await request(app).post("/api/auth/login").send(credentials).expect(200);
    const second = await request(app).post("/api/auth/login").send(credentials).expect(200);

    await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${first.body.data.accessToken}`)
      .expect(200);
    await request(app).post("/api/auth/refresh").send({ refreshToken: first.body.data.refreshToken }).expect(401);
    const secondRotated = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: second.body.data.refreshToken })
      .expect(200);

    await request(app)
      .post("/api/auth/logout-all")
      .set("Authorization", `Bearer ${secondRotated.body.data.accessToken}`)
      .expect(200);
    await request(app).post("/api/auth/refresh").send({ refreshToken: secondRotated.body.data.refreshToken }).expect(401);
  });

  it("reset e troca de senha revogam todas as sessões", async () => {
    await registerTenant("credential-revocation");
    const email = "admin-credential-revocation@example.com";
    const beforeReset = await request(app).post("/api/auth/login").send({ email, password: "secret123" }).expect(200);
    await request(app).post("/api/auth/forgot-password").send({ email }).expect(200);
    await request(app)
      .post("/api/auth/reset-password")
      .send({ email, token: "123456", newPassword: "after-reset-123" })
      .expect(200);
    await request(app).post("/api/auth/refresh").send({ refreshToken: beforeReset.body.data.refreshToken }).expect(401);

    const afterReset = await request(app).post("/api/auth/login").send({ email, password: "after-reset-123" }).expect(200);
    await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${afterReset.body.data.accessToken}`)
      .send({ currentPassword: "after-reset-123", newPassword: "after-change-123" })
      .expect(200);
    await request(app).post("/api/auth/refresh").send({ refreshToken: afterReset.body.data.refreshToken }).expect(401);
    await request(app).post("/api/auth/login").send({ email, password: "after-change-123" }).expect(200);
  });
});
