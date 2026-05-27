import { expect, test, type Page, type Request, type Route } from "@playwright/test";

const adminUser = {
  id: "user-1",
  name: "Ana Admin",
  email: "ana@example.com",
  role: "TENANT_ADMIN",
  tenantId: "tenant-1",
  instruments: [{ id: "instrument-1", name: "Teclado", colorHex: "#2563EB" }],
};

const globalAdminUser = {
  ...adminUser,
  id: "global-1",
  name: "Gael Global",
  email: "global@example.com",
  role: "GLOBAL_ADMIN",
};

const defaultInstruments = [
  { id: "instrument-1", name: "Teclado", colorHex: "#2563EB" },
  { id: "instrument-2", name: "Vocalista", colorHex: "#10B981" },
  { id: "instrument-3", name: "Multimídia", colorHex: "#7C3AED" },
  { id: "instrument-4", name: "Saxofone", colorHex: "#D97706" },
  { id: "instrument-5", name: "Violão", colorHex: "#F59E0B" },
  { id: "instrument-6", name: "Guitarra", colorHex: "#EF4444" },
  { id: "instrument-7", name: "Baixo", colorHex: "#8B5CF6" },
  { id: "instrument-8", name: "Bateria", colorHex: "#DC2626" },
  { id: "instrument-9", name: "Piano", colorHex: "#2563EB" },
  { id: "instrument-10", name: "Violino", colorHex: "#A855F7" },
  { id: "instrument-11", name: "Flauta", colorHex: "#14B8A6" },
  { id: "instrument-12", name: "Mesa de Som", colorHex: "#0F766E" },
  { id: "instrument-13", name: "Back Vocal", colorHex: "#22C55E" },
];

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
  options: {
    loginFails?: boolean;
    user?: typeof adminUser;
    schedules?: ReturnType<typeof defaultSchedules>;
    adminTenants?: Array<{
      id: string;
      name: string;
      createdAt: string;
      _count: { users: number; ministries: number; schedules: number; instruments: number };
    }>;
    adminTenantsError?: boolean;
    churchSummary?: {
      tenant: { id: string; name: string; createdAt?: string; updatedAt?: string };
      _count: { users: number; ministries: number; schedules: number; instruments: number };
    };
    churchError?: boolean;
    onChurchPatch?: (payload: { name?: string }) => void;
  } = {}
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
      body: JSON.stringify({ data: defaultInstruments }),
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
            ...defaultInstruments.filter(
              (instrument) => instrument.id !== "instrument-1" && body.instrumentIds?.includes(instrument.id)
            ),
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

  await page.route("**/api/admin/tenants", async (route) => {
    if (options.adminTenantsError) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Não foi possível carregar o painel global." }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: options.adminTenants ?? [
          {
            id: "tenant-1",
            name: "Igreja Central",
            createdAt: "2026-05-27T00:00:00.000Z",
            _count: { users: 4, ministries: 2, schedules: 3, instruments: 13 },
          },
          {
            id: "tenant-2",
            name: "Igreja Norte",
            createdAt: "2026-05-26T00:00:00.000Z",
            _count: { users: 2, ministries: 1, schedules: 1, instruments: 8 },
          },
        ],
      }),
    });
  });

  await page.route("**/api/church/me", async (route) => {
    if (options.churchError) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Não foi possível carregar os dados da igreja." }),
      });
      return;
    }

    const currentSummary =
      options.churchSummary ?? {
        tenant: { ...tenant, createdAt: "2026-05-27T00:00:00.000Z", updatedAt: "2026-05-27T00:00:00.000Z" },
        _count: { users: 2, ministries: 1, schedules: 1, instruments: 13 },
      };

    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as { name?: string };
      options.onChurchPatch?.(body);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            ...currentSummary,
            tenant: { ...currentSummary.tenant, name: body.name ?? currentSummary.tenant.name },
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: currentSummary }),
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
  await expect
    .poll(async () => {
      const storage = await page.evaluate(() => ({ ...window.localStorage }));
      return storage.auth_token;
    })
    .toBe(token);
  await expect(page.getByRole("tab", { name: "Perfil" })).toBeVisible();
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

test("admin global vê perfil, home e aba global com lista de igrejas", async ({ page }) => {
  await page.unroute("**/api/auth/login").catch(() => undefined);
  await page.unroute("**/api/members/me").catch(() => undefined);
  await mockApi(page, { user: globalAdminUser });
  await page.goto("/");

  await login(page, "global@example.com");

  await expect(page.getByText("Administrador global").first()).toBeVisible();
  await expect(page.getByText("Acesso global ao sistema").first()).toBeVisible();
  await expect(page.getByRole("tab", { name: "Global" })).toBeVisible();

  await page.getByText("Perfil").last().click();
  await expect(page.getByText("Acesso global", { exact: true })).toBeVisible();
  await expect(page.getByText("Abrir Painel Global")).toBeVisible();
  await page.getByTestId("open-global-admin-button").click();

  await expect(page.getByText("Painel global", { exact: true })).toBeVisible();
  await page.getByText("Perfil").last().click();
  await expect(page.getByText("Acesso global", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Global" }).click();
  await expect(page.getByText("Painel global", { exact: true })).toBeVisible();
  await expect(page.getByText("Igreja Central", { exact: true })).toBeVisible();
  await expect(page.getByText("Igreja Norte")).toBeVisible();
  await expect(page.getByText("tenant-1")).not.toBeVisible();
});

test("roles não globais não veem aba Admin Global", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("tab", { name: "Global" })).not.toBeVisible();
  await page.getByText("Perfil").last().click();
  await expect(page.getByText("Acesso global", { exact: true })).not.toBeVisible();

  await page.unroute("**/api/auth/login").catch(() => undefined);
  await page.unroute("**/api/members/me").catch(() => undefined);
  await mockApi(page, { user: memberUser });
  await page.evaluate(() => window.localStorage.clear());
  await page.goto("/");
  await login(page, "bruno@example.com");
  await expect(page.getByRole("tab", { name: "Global" })).not.toBeVisible();
  await page.getByText("Perfil").last().click();
  await expect(page.getByText("Acesso global", { exact: true })).not.toBeVisible();

  await page.unroute("**/api/auth/login").catch(() => undefined);
  await page.unroute("**/api/members/me").catch(() => undefined);
  await mockApi(page, { user: leaderUser });
  await page.evaluate(() => window.localStorage.clear());
  await page.goto("/");
  await login(page, "lia@example.com");
  await expect(page.getByRole("tab", { name: "Global" })).not.toBeVisible();
  await page.getByText("Perfil").last().click();
  await expect(page.getByText("Acesso global", { exact: true })).not.toBeVisible();
});

test("TENANT_ADMIN vê aba Igreja, contadores reais e edita nome", async ({ page }) => {
  let patchPayload: { name?: string } | undefined;
  await page.unroute("**/api/church/me").catch(() => undefined);
  await mockApi(page, {
    churchSummary: {
      tenant: { id: "tenant-1", name: "Igreja Central", createdAt: "2026-05-27T00:00:00.000Z" },
      _count: { users: 5, ministries: 2, schedules: 3, instruments: 9 },
    },
    onChurchPatch: (payload) => {
      patchPayload = payload;
    },
  });
  await page.goto("/");

  await login(page);
  await expect(page.getByRole("tab", { name: "Igreja" })).toBeVisible();
  await page.getByRole("tab", { name: "Igreja" }).click();

  await expect(page.getByRole("heading", { name: "Dados da Igreja" })).toBeVisible();
  await expect(page.getByText("Igreja Central", { exact: true })).toBeVisible();
  await expect(page.getByText("5", { exact: true })).toBeVisible();
  await expect(page.getByText("2", { exact: true })).toBeVisible();
  await expect(page.getByText("3", { exact: true })).toBeVisible();
  await expect(page.getByText("9", { exact: true })).toBeVisible();
  await expect(page.getByText("Gerenciar").first()).toBeVisible();

  await page.getByText("Editar").click();
  await page.getByLabel("Nome da igreja").fill("Igreja Renovada");
  await page.getByText("Salvar").click();

  await expect.poll(() => patchPayload?.name).toBe("Igreja Renovada");
  await expect(page.getByText("Igreja Renovada")).toBeVisible();
});

test("somente TENANT_ADMIN vê aba Igreja", async ({ page }) => {
  await page.unroute("**/api/auth/login").catch(() => undefined);
  await page.unroute("**/api/members/me").catch(() => undefined);
  await mockApi(page, { user: memberUser });
  await page.goto("/");
  await login(page, "bruno@example.com");
  await expect(page.getByRole("tab", { name: "Igreja" })).not.toBeVisible();

  await page.unroute("**/api/auth/login").catch(() => undefined);
  await page.unroute("**/api/members/me").catch(() => undefined);
  await mockApi(page, { user: leaderUser });
  await page.evaluate(() => window.localStorage.clear());
  await page.goto("/");
  await login(page, "lia@example.com");
  await expect(page.getByRole("tab", { name: "Igreja" })).not.toBeVisible();

  await page.unroute("**/api/auth/login").catch(() => undefined);
  await page.unroute("**/api/members/me").catch(() => undefined);
  await mockApi(page, { user: globalAdminUser });
  await page.evaluate(() => window.localStorage.clear());
  await page.goto("/");
  await login(page, "global@example.com");
  await expect(page.getByRole("tab", { name: "Igreja" })).not.toBeVisible();
});

test("Dados da Igreja exibe erro de API e não mostra outro tenant", async ({ page }) => {
  await page.unroute("**/api/church/me").catch(() => undefined);
  await mockApi(page, { churchError: true });
  await page.goto("/");

  await login(page);
  await page.getByRole("tab", { name: "Igreja" }).click();

  await expect(page.getByText("Não foi possível carregar os dados da igreja.")).toBeVisible();
  await expect(page.getByText("Igreja Norte")).not.toBeVisible();
});

test("admin global vê contadores reais no painel global", async ({ page }) => {
  await page.unroute("**/api/auth/login").catch(() => undefined);
  await page.unroute("**/api/members/me").catch(() => undefined);
  await page.unroute("**/api/admin/tenants").catch(() => undefined);
  await mockApi(page, {
    user: globalAdminUser,
    adminTenants: [
      {
        id: "tenant-1",
        name: "Igreja Central",
        createdAt: "2026-05-27T00:00:00.000Z",
        _count: { users: 2, ministries: 1, schedules: 0, instruments: 10 },
      },
    ],
  });
  await page.goto("/");

  await login(page, "global@example.com");
  await page.getByRole("tab", { name: "Global" }).click();

  await expect(page.getByText("Igrejas", { exact: true })).toBeVisible();
  await expect(page.getByText("Usuários", { exact: true })).toBeVisible();
  await expect(page.getByText("Igreja Central")).toBeVisible();
  await expect(page.getByText("2 usuários")).toBeVisible();
  await expect(page.getByText("1 ministério")).toBeVisible();
  await expect(page.getByText("10 instrumentos")).toBeVisible();
  await expect(page.getByText("0 escalas")).toBeVisible();
});

test("painel global exibe erro e empty state conforme resposta da API", async ({ page }) => {
  await page.unroute("**/api/auth/login").catch(() => undefined);
  await page.unroute("**/api/members/me").catch(() => undefined);
  await page.unroute("**/api/admin/tenants").catch(() => undefined);
  await mockApi(page, { user: globalAdminUser, adminTenantsError: true });
  await page.goto("/");

  await login(page, "global@example.com");
  await page.getByRole("tab", { name: "Global" }).click();
  await expect(page.getByText("Não foi possível carregar o painel global.")).toBeVisible();

  await page.unroute("**/api/auth/login").catch(() => undefined);
  await page.unroute("**/api/members/me").catch(() => undefined);
  await page.unroute("**/api/admin/tenants").catch(() => undefined);
  await mockApi(page, { user: globalAdminUser, adminTenants: [] });
  await page.evaluate(() => window.localStorage.clear());
  await page.goto("/");

  await login(page, "global@example.com");
  await page.getByRole("tab", { name: "Global" }).click();
  await expect(page.getByText("Nenhuma igreja cadastrada.")).toBeVisible();
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

test("mostra instrumentos selecionados no Perfil sem expor ids", async ({ page }) => {
  await login(page);
  await page.getByText("Perfil").last().click();

  await expect(page.getByText("Meus instrumentos/cargos")).toBeVisible();
  await expect(page.getByText("Teclado").first()).toBeVisible();
  await expect(page.getByText("instrument-1")).not.toBeVisible();
});

test("abre seletor de instrumentos e permite fechar", async ({ page }) => {
  await login(page);
  await page.getByText("Perfil").last().click();

  await page.getByTestId("open-instrument-picker").click();
  await expect(page.getByText("Selecionar instrumentos/cargos")).toBeVisible();
  await expect(page.getByTestId("instrument-toggle-instrument-1")).toBeVisible();
  await expect(page.getByTestId("instrument-toggle-instrument-2")).toBeVisible();
  await expect(page.getByTestId("instrument-toggle-instrument-3")).toBeVisible();
  await expect(page.getByText("Multimídia")).toBeVisible();
  await expect(page.getByText("instrument-3")).not.toBeVisible();

  await page.getByLabel("Fechar seleção de instrumentos").click();
  await expect(page.getByText("Selecionar instrumentos/cargos")).not.toBeVisible();
});

test("permite editar instrumentos no perfil pelo seletor", async ({ page }) => {
  await login(page);
  await page.getByText("Perfil").last().click();

  await expect(page.getByText("Meus instrumentos/cargos")).toBeVisible();
  await expect(page.getByText("Teclado")).toBeVisible();

  await page.getByTestId("open-instrument-picker").click();
  await page.getByTestId("instrument-toggle-instrument-2").click();

  await expect
    .poll(async () => {
      const storage = await page.evaluate(() => ({ ...window.localStorage }));
      return storage.auth_user ?? "";
    })
    .toContain("Vocalista");
  await page.getByTestId("instrument-toggle-instrument-3").click();
  await expect
    .poll(async () => {
      const storage = await page.evaluate(() => ({ ...window.localStorage }));
      return storage.auth_user ?? "";
    })
    .toContain("Multimídia");
  await expect(page.getByText("instrument-2")).not.toBeVisible();
  await expect(page.getByText("instrument-3")).not.toBeVisible();
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
            { id: "instrument-2", name: "Vocalista", colorHex: "#10B981" },
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
  await page.getByTestId("open-instrument-picker").click();
  await page.getByTestId("instrument-toggle-instrument-2").click();

  await expect.poll(() => updateRequests).toBe(1);
  expect(lastPayload?.instrumentIds).toEqual(["instrument-1", "instrument-2"]);
  await expect
    .poll(async () => {
      const storage = await page.evaluate(() => ({ ...window.localStorage }));
      return storage.auth_user ?? "";
    })
    .toContain("Vocalista");
});
