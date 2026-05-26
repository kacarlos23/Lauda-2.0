import { expect, test, type Page, type Request, type Route } from "@playwright/test";

const adminUser = {
  id: "user-1",
  name: "Ana Admin",
  email: "ana@example.com",
  role: "TENANT_ADMIN",
  tenantId: "tenant-1",
  instruments: [{ id: "instrument-1", name: "Teclado", colorHex: "#2563EB" }],
};

const leaderUser = {
  ...adminUser,
  id: "leader-1",
  name: "Lia Líder",
  email: "lia@example.com",
  role: "MINISTRY_LEADER",
};

const memberUser = {
  ...adminUser,
  id: "member-1",
  name: "Bruno Membro",
  email: "bruno@example.com",
  role: "MEMBER",
};

const tenant = { id: "tenant-1", name: "Igreja Central" };
const token = "test.jwt.token";

function defaultSchedules(userId: string) {
  return [
    {
      id: "assignment-1",
      scheduleId: "schedule-1",
      userId,
      role: "Vocal",
      status: "PENDING",
      tenantId: tenant.id,
      schedule: {
        id: "schedule-1",
        title: "Culto de domingo",
        date: "2099-01-01T12:00:00.000Z",
        ministryId: "ministry-1",
        tenantId: tenant.id,
        ministry: { id: "ministry-1", name: "Louvor" },
      },
    },
  ];
}

async function mockApi(
  page: Page,
  options: { loginFails?: boolean; user?: typeof adminUser; schedules?: ReturnType<typeof defaultSchedules> } = {}
) {
  const currentUser = options.user ?? adminUser;
  const schedules = options.schedules ?? defaultSchedules(currentUser.id);

  await page.route("**/api/auth/login", async (route) => {
    const body = route.request().postDataJSON() as { email?: string; password?: string };
    if (options.loginFails || body.password === "wrongpass") {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Credenciais inválidas" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { token, refreshToken: "refresh-token", user: { ...currentUser, email: body.email }, tenant },
      }),
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
          tenant,
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
          id: currentUser.id,
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
      body: JSON.stringify({ data: currentUser }),
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
          currentUser,
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

  await page.route("**/api/schedules/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: schedules }),
    });
  });

  await page.route("**/api/schedules/*/assignments/*/status", async (route) => {
    const body = route.request().postDataJSON() as { status?: string };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { ...schedules[0], status: body.status ?? "ACCEPTED" } }),
    });
  });
}

async function login(page: Page, email = "ana@example.com", password = "secret123") {
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page.getByText(/Ana|Lia|Bruno/)).toBeVisible();
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

test("redireciona usuário anônimo para login e bloqueia área autenticada", async ({ page }) => {
  await page.goto("/members");

  await expect(page.getByTestId("login-email")).toBeVisible();
  await expect(page.getByTestId("login-password")).toBeVisible();
});

test("valida campos obrigatórios no login antes de chamar a API", async ({ page }) => {
  let loginRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/auth/login")) loginRequests += 1;
  });

  await page.getByTestId("login-submit").click();
  await page.waitForTimeout(300);
  expect(loginRequests).toBe(0);
  await expect(page.getByTestId("login-email")).toBeVisible();
});

test("faz login, envia token em requisições protegidas e não persiste senha", async ({ page }) => {
  let ministriesRequest: Request | undefined;
  page.on("request", (request) => {
    if (request.url().includes("/api/ministries")) ministriesRequest = request;
  });

  await login(page);
  await page.getByText("Ministérios").last().click();

  await expect(page.getByText("Louvor", { exact: true })).toBeVisible();
  expect(ministriesRequest?.headers().authorization).toBe(`Bearer ${token}`);

  const storage = await page.evaluate(() => ({ ...window.localStorage }));
  expect(JSON.stringify(storage)).not.toContain("secret123");
  expect(storage.auth_token).toBe(token);
  expect(storage.auth_tenant).toContain("Igreja Central");
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
  expect(storage.auth_tenant).toContain("Igreja Central");
});

test("permite sair da conta e limpa a sessão local", async ({ page }) => {
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
  expect(storage.auth_tenant).toBeUndefined();
});

test("mostra badges de instrumentos na lista de membros sem expor ids", async ({ page }) => {
  await login(page);
  await page.getByText("Membros").last().click();

  await expect(page.getByText("Instrumentos/Cargos").first()).toBeVisible();
  await expect(page.getByText("Teclado").first()).toBeVisible();
  await expect(page.getByText("Nenhum instrumento informado")).toBeVisible();
  await expect(page.getByText("instrument-1")).not.toBeVisible();
});

test("abre modal e permite cancelar alteração de instrumentos", async ({ page }) => {
  await login(page);
  await page.getByText("Perfil").last().click();

  await page.getByTestId("edit-instruments-button").click();
  await expect(page.getByTestId("instrument-selection-modal")).toBeVisible();
  await expect(page.getByText("Escolha seus instrumentos/cargos")).toBeVisible();
  await expect(page.getByText("🎹")).toBeVisible();
  await expect(page.getByText("🎤")).toBeVisible();

  await page.getByTestId("instrument-option-instrument-2").click();
  await expect(page.getByText("Selecionado").nth(1)).toBeVisible();
  await page.getByTestId("cancel-instruments-selection").click();
  await expect(page.getByTestId("instrument-selection-modal")).not.toBeVisible();

  const storage = await page.evaluate(() => ({ ...window.localStorage }));
  expect(storage.auth_user).not.toContain("Vocal");
});

test("permite editar instrumentos no perfil por modal com seleção múltipla", async ({ page }) => {
  await login(page);
  await page.getByText("Perfil").last().click();

  await expect(page.getByText("Meus instrumentos/cargos")).toBeVisible();
  await expect(page.getByText("Selecionados")).toBeVisible();
  await expect(page.getByText("Teclado")).toBeVisible();

  await page.getByTestId("edit-instruments-button").click();
  await page.getByTestId("instrument-option-instrument-2").click();
  await page.getByTestId("save-instruments-selection").click();

  await expect
    .poll(async () => {
      const storage = await page.evaluate(() => ({ ...window.localStorage }));
      return storage.auth_user ?? "";
    })
    .toContain("Vocal");
  await expect(page.getByTestId("instrument-selection-modal")).not.toBeVisible();
  await expect(page.getByText("instrument-2")).not.toBeVisible();
});

test("membro comum edita os próprios instrumentos pelo modal do Perfil", async ({ page }) => {
  let updateRequests = 0;
  let lastPayload: { instrumentIds?: string[] } | undefined;

  await page.unroute("**/api/auth/login").catch(() => undefined);
  await page.unroute("**/api/members/me").catch(() => undefined);
  await page.unroute("**/api/members/me/instruments").catch(() => undefined);
  await page.unroute("**/api/members/*/instruments").catch(() => undefined);
  await mockApi(page, { user: memberUser });
  await page.route("**/api/members/me/instruments", async (route) => {
    updateRequests += 1;
    lastPayload = route.request().postDataJSON() as { instrumentIds?: string[] };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: memberUser.id,
          instruments: [
            { id: "instrument-1", name: "Teclado", colorHex: "#2563EB" },
            { id: "instrument-2", name: "Vocal", colorHex: "#10B981" },
          ],
        },
      }),
    });
  });
  await page.goto("/");

  await login(page, "bruno@example.com");
  await page.getByText("Perfil").last().click();

  await expect(page.getByText("Membro").first()).toBeVisible();
  await expect(page.getByText("Meus instrumentos/cargos")).toBeVisible();
  await page.getByTestId("edit-instruments-button").click();
  await page.getByTestId("instrument-option-instrument-2").click();
  await page.getByTestId("save-instruments-selection").click();

  await expect.poll(() => updateRequests).toBe(1);
  expect(lastPayload?.instrumentIds).toEqual(["instrument-1", "instrument-2"]);
  await expect
    .poll(async () => {
      const storage = await page.evaluate(() => ({ ...window.localStorage }));
      return storage.auth_user ?? "";
    })
    .toContain("Vocal");
});