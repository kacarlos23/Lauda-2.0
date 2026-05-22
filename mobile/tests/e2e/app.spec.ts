import { expect, test, type Page, type Request, type Route } from "@playwright/test";

const adminUser = {
  id: "user-1",
  name: "Ana Admin",
  email: "ana@example.com",
  role: "TENANT_ADMIN",
  tenantId: "tenant-1",
  instruments: [{ id: "instrument-1", name: "Teclado", colorHex: "#2563EB" }],
};

const token = "test.jwt.token";

async function mockApi(page: Page, options: { loginFails?: boolean } = {}) {
  await page.route("**/api/auth/login", async (route) => {
    const body = route.request().postDataJSON() as { email?: string; password?: string };
    if (options.loginFails || body.password === "wrongpass") {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Credenciais invalidas" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
          body: JSON.stringify({ data: { token, refreshToken: "refresh-token", user: { ...adminUser, email: body.email } } }),
    });
  });

  await page.route("**/api/auth/register", async (route) => {
    const body = route.request().postDataJSON() as { name?: string; email?: string };
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          token,
          refreshToken: "refresh-token",
          user: { ...adminUser, name: body.name ?? adminUser.name, email: body.email ?? adminUser.email },
        },
      }),
    });
  });

  await page.route("**/api/instruments", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          { id: "instrument-1", name: "Teclado", colorHex: "#2563EB" },
          { id: "instrument-2", name: "Vocal", colorHex: "#10B981" },
        ],
      }),
    });
  });

  const fulfillInstrumentUpdate = async (route: Route) => {
    const body = route.request().postDataJSON() as { instrumentIds?: string[] };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: adminUser.id,
          instruments: [
            ...(body.instrumentIds?.includes("instrument-1")
              ? [{ id: "instrument-1", name: "Teclado", colorHex: "#2563EB" }]
              : []),
            ...(body.instrumentIds?.includes("instrument-2")
              ? [{ id: "instrument-2", name: "Vocal", colorHex: "#10B981" }]
              : []),
          ],
        },
      }),
    });
  };

  await page.route("**/api/members/me/instruments", fulfillInstrumentUpdate);
  await page.route("**/api/members/*/instruments", fulfillInstrumentUpdate);

  await page.route("**/api/members/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: adminUser }),
    });
  });

  await page.route("**/api/ministries", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: "ministry-1",
            name: "Louvor",
            description: "Equipe principal",
            _count: { members: 3 },
          },
        ],
      }),
    });
  });

  await page.route("**/api/members", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          adminUser,
          {
            id: "user-2",
            name: "Bruno Membro",
            email: "bruno@example.com",
            role: "MEMBER",
            tenantId: "tenant-1",
            instruments: [],
            ministries: [],
          },
        ],
      }),
    });
  });
}

async function login(page: Page, email = "ana@example.com", password = "secret123") {
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page.getByText(/Ana/)).toBeVisible();
  await expect
    .poll(async () => {
      const storage = await page.evaluate(() => ({ ...window.localStorage }));
      return storage.auth_token;
    })
    .toBe(token);
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
});

test("redireciona usuario anonimo para login e bloqueia area autenticada", async ({ page }) => {
  await page.goto("/members");

  await expect(page.getByTestId("login-email")).toBeVisible();
  await expect(page.getByTestId("login-password")).toBeVisible();
});

test("valida campos obrigatorios no login antes de chamar a API", async ({ page }) => {
  let loginRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/auth/login")) loginRequests += 1;
  });

  await page.getByTestId("login-submit").click();
  await page.waitForTimeout(300);
  expect(loginRequests).toBe(0);
  await expect(page.getByTestId("login-email")).toBeVisible();
});

test("faz login, envia token em requisicoes protegidas e nao persiste senha", async ({ page }) => {
  let ministriesRequest: Request | undefined;
  page.on("request", (request) => {
    if (request.url().includes("/api/ministries")) ministriesRequest = request;
  });

  await login(page);
  await page.getByText("Ministérios").last().click();

  await expect(page.getByText("Louvor")).toBeVisible();
  expect(ministriesRequest?.headers().authorization).toBe(`Bearer ${token}`);

  const storage = await page.evaluate(() => ({ ...window.localStorage }));
  expect(JSON.stringify(storage)).not.toContain("secret123");
  expect(storage.auth_token).toBe(token);
});

test("valida cadastro e conclui fluxo de primeiro administrador", async ({ page }) => {
  await page.getByTestId("go-register").click();
  await expect(page.getByText("Nova igreja")).toBeVisible();

  let registerRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/auth/register")) registerRequests += 1;
  });

  await page.getByTestId("register-submit").click();
  await page.waitForTimeout(300);
  expect(registerRequests).toBe(0);

  await page.getByTestId("register-church").fill("Igreja Central");
  await page.getByTestId("register-name").fill("Maria Admin");
  await page.getByTestId("register-email").fill("maria@example.com");
  await page.getByTestId("register-password").fill("secret123");
  await page.getByTestId("register-confirm").fill("secret123");
  await page.getByTestId("register-submit").click();

  await expect(page.getByText(/Maria/)).toBeVisible();
  const storage = await page.evaluate(() => ({ ...window.localStorage }));
  expect(JSON.stringify(storage)).not.toContain("secret123");
});

test("permite sair da conta e limpa a sessao local", async ({ page }) => {
  await login(page);
  await page.getByText("Perfil").last().click();

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("encerrar");
    await dialog.accept();
  });
  await page.getByTestId("logout-submit").click({ force: true });

  await expect(page.getByTestId("login-email")).toBeVisible();
  const storage = await page.evaluate(() => ({ ...window.localStorage }));
  expect(storage.auth_token).toBeUndefined();
  expect(storage.auth_user).toBeUndefined();
});

test("mostra badges de instrumentos na lista de membros sem expor ids", async ({ page }) => {
  await login(page);
  await page.getByText("Membros").last().click();

  await expect(page.getByText("Instrumentos/Cargos").first()).toBeVisible();
  await expect(page.getByText("Teclado").first()).toBeVisible();
  await expect(page.getByText("Nenhum instrumento informado")).toBeVisible();
  await expect(page.getByText("instrument-1")).not.toBeVisible();
});

test("permite editar instrumentos no perfil com atualizacao otimista e persistencia local", async ({ page }) => {
  await login(page);
  await page.getByText("Perfil").last().click();

  await expect(page.getByText("Meus instrumentos/cargos")).toBeVisible();
  await expect(page.getByText("Teclado")).toBeVisible();
  await page.getByTestId("instrument-toggle-instrument-2").click({ force: true });

  await expect
    .poll(async () => {
      const storage = await page.evaluate(() => ({ ...window.localStorage }));
      return storage.auth_user ?? "";
    })
    .toContain("Vocal");
  await expect(page.getByText("instrument-2")).not.toBeVisible();
});
