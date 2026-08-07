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
    adminUsers?: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      tenantId: string;
      tenant: { id: string; name: string };
      createdAt: string;
    }>;
    adminMinistries?: Array<{
      id: string;
      name: string;
      description?: string;
      tenantId: string;
      tenant: { id: string; name: string };
      createdAt: string;
      _count: { members: number; schedules: number };
    }>;
    adminTenantsError?: boolean;
    churchSummary?: {
      tenant: { id: string; name: string; createdAt?: string; updatedAt?: string };
      _count: { users: number; ministries: number; schedules: number; instruments: number };
    };
    churchError?: boolean;
    onChurchPatch?: (payload: { name?: string }) => void;
    onProfilePatch?: (payload: { name?: string; phone?: string | null; avatarUrl?: string | null }) => void;
  } = {}
) {
  const currentUser = options.user ?? adminUser;
  const profileUser = { ...currentUser };
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
    const instruments = [
      ...(body.instrumentIds?.includes("instrument-1")
        ? [{ id: "instrument-1", name: "Teclado", colorHex: "#2563EB" }]
        : []),
      ...defaultInstruments.filter(
        (instrument) => instrument.id !== "instrument-1" && body.instrumentIds?.includes(instrument.id)
      ),
    ];
    profileUser.instruments = instruments;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: currentUser.id,
          instruments,
        },
      }),
    });
  };

  await page.route("**/api/members/me/instruments", fulfillInstrumentUpdate);
  await page.route("**/api/members/*/instruments", fulfillInstrumentUpdate);

  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          user: profileUser,
          tenant,
          permissions: [],
        },
      }),
    });
  });

  await page.route("**/api/members/me/profile", async (route) => {
    const payload = route.request().postDataJSON() as { name?: string; phone?: string | null; avatarUrl?: string | null };
    Object.assign(profileUser, payload);
    options.onProfilePatch?.(payload);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: profileUser }) });
  });

  await page.route("**/api/members/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: profileUser }),
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

  await page.route("**/api/schedules**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: path === "/api/schedules/me" ? schedules : schedules.map((assignment) => assignment.schedule) }),
    });
  });

  await page.route("**/api/admin/tenants**", async (route) => {
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
        success: true,
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

  await page.route("**/api/admin/users**", async (route) => {
    if (options.adminTenantsError) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Não foi possível carregar usuários globais." }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: options.adminUsers ?? [
          {
            id: "global-1",
            name: "Gael Global",
            email: "global@example.com",
            role: "GLOBAL_ADMIN",
            tenantId: "tenant-1",
            tenant: { id: "tenant-1", name: "Igreja Central" },
            createdAt: "2026-05-27T00:00:00.000Z",
          },
          {
            id: "member-2",
            name: "Bruno Membro",
            email: "bruno@example.com",
            role: "MEMBER",
            tenantId: "tenant-2",
            tenant: { id: "tenant-2", name: "Igreja Norte" },
            createdAt: "2026-05-26T00:00:00.000Z",
          },
        ],
      }),
    });
  });

  await page.route("**/api/admin/ministries**", async (route) => {
    if (options.adminTenantsError) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Não foi possível carregar ministérios globais." }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: options.adminMinistries ?? [
          {
            id: "ministry-1",
            name: "Louvor",
            description: "Equipe principal",
            tenantId: "tenant-1",
            tenant: { id: "tenant-1", name: "Igreja Central" },
            createdAt: "2026-05-27T00:00:00.000Z",
            _count: { members: 3, schedules: 2 },
          },
        ],
      }),
    });
  });

  const emptyAdminResources = [
    "instruments",
    "user-instruments",
    "artists",
    "songs",
    "ministry-songs",
    "schedules",
    "schedule-songs",
    "schedule-assignments",
    "member-invites",
    "audit-logs",
  ];

  for (const resource of emptyAdminResources) {
    await page.route(`**/api/admin/${resource}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      });
    });
  }

  await page.route("**/api/songs**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          items: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        },
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

  await page.route("**/api/notifications**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/notifications" && route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { items: [], unreadCount: 0, nextCursor: null } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    });
  });
}

async function login(page: Page, email = "ana@example.com", password = "secret123") {
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-password").press("Enter");
  await expect
    .poll(async () => {
      const storage = await page.evaluate(() => ({ ...window.localStorage }));
      return storage.auth_token;
    })
    .toBe(token);
  await expect(page.getByTestId("header-profile-button").last()).toBeVisible();
  await expect(page.getByRole("tab", { name: "Perfil" })).not.toBeVisible();
}

async function openNavigationItem(page: Page, label: string, sidebarId: string) {
  const sidebarLink = page.getByTestId(sidebarId);
  if (await sidebarLink.isVisible().catch(() => false)) {
    await sidebarLink.click();
    return;
  }

  await page.getByRole("tab", { name: label }).click();
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

test("exibe globalmente um anel de foco visível", async ({ page }) => {
  const emailInput = page.getByTestId("login-email");
  await emailInput.click();
  await emailInput.fill("ana@example.com");

  await expect(emailInput).toBeFocused();
  await expect.poll(() => emailInput.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("solid");
  await expect.poll(() => emailInput.evaluate((element) => Number.parseFloat(getComputedStyle(element).outlineWidth))).toBeGreaterThanOrEqual(2);

  const submitButton = page.getByTestId("login-submit");
  await submitButton.focus();

  await expect(submitButton).toBeFocused();
  await expect.poll(() => submitButton.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("solid");
  await expect.poll(() => submitButton.evaluate((element) => Number.parseFloat(getComputedStyle(element).outlineWidth))).toBeGreaterThanOrEqual(2);
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
  await openNavigationItem(page, "Ministérios", "sidebar-nav-ministries");

  await expect(page.getByText("Louvor", { exact: true })).toBeVisible();
  expect(ministriesRequest?.headers().authorization).toBe(`Bearer ${token}`);

  const storage = await page.evaluate(() => ({ ...window.localStorage }));
  expect(JSON.stringify(storage)).not.toContain("secret123");
  expect(storage.auth_token).toBe(token);
  expect(storage.auth_tenant).toContain("Igreja Central");
});

test("anima a seleção entre a sidebar e as abas móveis", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);

  const activeRail = page.getByTestId("sidebar-active-rail");
  await expect(activeRail).toBeVisible();
  const initialRailPosition = await activeRail.boundingBox();

  await page.getByTestId("sidebar-nav-ministries").click();
  await expect(page).toHaveURL(/\/ministries$/);
  await expect
    .poll(async () => (await activeRail.boundingBox())?.y)
    .not.toBe(initialRailPosition?.y);

  await page.setViewportSize({ width: 390, height: 844 });
  const bubbles = page.locator('[data-testid="mobile-tab-bubble"]:visible');
  const bubble = bubbles.first();
  const bubbleCenterDistance = async (tabName: string) => {
    const tab = page.getByRole("tab", { name: tabName }).first();
    const [bubbleBox, tabBox] = await Promise.all([
      bubble.boundingBox(),
      tab.boundingBox(),
    ]);
    if (!bubbleBox || !tabBox) return Number.POSITIVE_INFINITY;
    return Math.abs(
      bubbleBox.x + bubbleBox.width / 2
      - (tabBox.x + tabBox.width / 2)
    );
  };

  await expect(bubble).toBeVisible();
  await expect(bubbles).toHaveCount(1);
  await expect.poll(() => bubbleCenterDistance("Ministérios")).toBeLessThanOrEqual(1);
  await expect.poll(async () => {
    const box = await bubble.boundingBox();
    return Math.abs((box?.width ?? 0) - 68) + Math.abs((box?.height ?? 0) - 68);
  }).toBeLessThanOrEqual(1);

  const ministriesSelection = page.locator(
    '[data-testid="mobile-tab-selection-ministries"]:visible'
  ).first();
  const ministriesLabel = page.locator(
    '[data-testid="mobile-tab-label-selection-ministries"]:visible'
  ).first();
  await expect(ministriesSelection).toHaveCSS("opacity", "1");
  await expect(ministriesLabel).toHaveText("Ministérios");
  await expect.poll(() => ministriesLabel.evaluate(
    (element) => element.scrollWidth - element.clientWidth
  )).toBeLessThanOrEqual(0);

  await page.getByRole("tab", { name: "Início" }).first().click();
  await expect.poll(() => bubbleCenterDistance("Início")).toBeLessThanOrEqual(1);
  await expect(
    page.locator('[data-testid="mobile-tab-selection-home"]:visible').first()
  ).toHaveCSS("opacity", "1");

  await page.getByRole("tab", { name: "Escalas" }).first().click();
  await page.getByRole("tab", { name: "Músicas" }).first().click();
  await expect(page).toHaveURL(/\/songs$/);
  await expect.poll(() => bubbleCenterDistance("Músicas")).toBeLessThanOrEqual(1);
  await expect(bubbles).toHaveCount(1);
  await expect(
    page.locator('[data-testid="mobile-tab-selection-songs"]:visible').first()
  ).toHaveCSS("opacity", "1");
  const songsIcon = page.locator(
    '[data-testid="mobile-tab-selection-songs"]:visible'
  ).first();
  const songsLabel = page.locator(
    '[data-testid="mobile-tab-label-selection-songs"]:visible'
  ).first();
  await expect.poll(async () => {
    const [bubbleBox, iconBox, labelBox] = await Promise.all([
      bubble.boundingBox(),
      songsIcon.boundingBox(),
      songsLabel.boundingBox(),
    ]);
    if (!bubbleBox || !iconBox || !labelBox) return Number.POSITIVE_INFINITY;
    const bubbleRight = bubbleBox.x + bubbleBox.width;
    const bubbleBottom = bubbleBox.y + bubbleBox.height;
    return Math.max(
      0,
      bubbleBox.x - iconBox.x,
      iconBox.x + iconBox.width - bubbleRight,
      bubbleBox.y - iconBox.y,
      iconBox.y + iconBox.height - bubbleBottom,
      bubbleBox.x - labelBox.x,
      labelBox.x + labelBox.width - bubbleRight,
      bubbleBox.y - labelBox.y,
      labelBox.y + labelBox.height - bubbleBottom
    );
  }).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "test-results/mobile-tab-bubble.png" });

  await page.setViewportSize({ width: 320, height: 844 });
  await expect.poll(() => bubbleCenterDistance("Músicas")).toBeLessThanOrEqual(1);
  await expect(ministriesLabel).toHaveText("Ministérios");

  await page.setViewportSize({ width: 1200, height: 820 });
  await expect(page.getByTestId("mobile-tab-bubble")).toBeHidden();
});

test("admin global vê perfil, home e aba global com lista de igrejas", async ({ page }) => {
  await page.unroute("**/api/auth/login").catch(() => undefined);
  await page.unroute("**/api/members/me").catch(() => undefined);
  await mockApi(page, { user: globalAdminUser });
  await page.goto("/");

  await login(page, "global@example.com");

  await expect(page.getByText("Administrador global").first()).toBeVisible();
  await expect(page.getByText("Acesso global ao sistema").first()).toBeVisible();
  await expect(page.getByRole("tab", { name: "Global" })).not.toBeVisible();
  await expect(page.getByRole("tab", { name: "Perfil" })).not.toBeVisible();

  await page.getByTestId("header-profile-button").last().click();
  await expect(page.getByText("Acesso global", { exact: true })).toBeVisible();
  await expect(page.getByText("Abrir Painel Global")).toBeVisible();
  await page.getByTestId("open-global-admin-button").click();

  await expect(page.getByText("Operação global", { exact: true })).toBeVisible();
  await expect(page.getByText("Igrejas", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Abrir perfil" }).click();
  await expect(page.getByText("Acesso global", { exact: true })).toBeVisible();

  await expect(page.getByText("Abrir Painel Global")).toBeVisible();
});

test("roles não globais não veem aba Admin Global", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("tab", { name: "Global" })).not.toBeVisible();
  await page.getByTestId("header-profile-button").last().click();
  await expect(page.getByText("Acesso global", { exact: true })).not.toBeVisible();

  await page.unroute("**/api/auth/login").catch(() => undefined);
  await page.unroute("**/api/members/me").catch(() => undefined);
  await mockApi(page, { user: memberUser });
  await page.evaluate(() => window.localStorage.clear());
  await page.goto("/");
  await login(page, "bruno@example.com");
  await expect(page.getByRole("tab", { name: "Global" })).not.toBeVisible();
  await page.getByTestId("header-profile-button").last().click();
  await expect(page.getByText("Acesso global", { exact: true })).not.toBeVisible();

  await page.unroute("**/api/auth/login").catch(() => undefined);
  await page.unroute("**/api/members/me").catch(() => undefined);
  await mockApi(page, { user: leaderUser });
  await page.evaluate(() => window.localStorage.clear());
  await page.goto("/");
  await login(page, "lia@example.com");
  await expect(page.getByRole("tab", { name: "Global" })).not.toBeVisible();
  await page.getByTestId("header-profile-button").last().click();
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
  await expect(page.getByTestId("sidebar-nav-church")).toBeVisible();
  await openNavigationItem(page, "Igreja", "sidebar-nav-church");

  await expect(page.getByText("Dados da Igreja", { exact: true })).toBeVisible();
  await expect(page.getByText("Igreja Central", { exact: true }).last()).toBeVisible();
  await expect(page.getByLabel("Membros: 5")).toBeVisible();
  await expect(page.getByLabel("Ministérios: 2")).toBeVisible();
  await expect(page.getByLabel("Escalas: 3")).toBeVisible();
  await expect(page.getByLabel("Instrumentos: 9")).toBeVisible();
  await expect(page.getByText("Gerenciar").first()).toBeVisible();

  await page.getByText("Editar").click();
  await page.getByLabel("Nome da igreja").fill("Igreja Renovada");
  await page.getByLabel("Nome da igreja").press("Enter");

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

});

test("Dados da Igreja exibe erro de API e não mostra outro tenant", async ({ page }) => {
  await page.unroute("**/api/church/me").catch(() => undefined);
  await mockApi(page, { churchError: true });
  await page.goto("/");

  await login(page);
  await openNavigationItem(page, "Igreja", "sidebar-nav-church");

  await expect(page.getByText("Não foi possível carregar os dados da igreja.")).toBeVisible();
  await expect(page.getByText("Igreja Norte")).not.toBeVisible();
});

test("GLOBAL_ADMIN visualiza dados reais no Painel Global", async ({ page }) => {
  let adminTenantsRequest: Request | undefined;
  page.on("request", (request) => {
    if (request.url().includes("/api/admin/tenants")) adminTenantsRequest = request;
  });
  await page.unroute("**/api/auth/login").catch(() => undefined);
  await page.unroute("**/api/members/me").catch(() => undefined);
  await page.unroute("**/api/admin/tenants**").catch(() => undefined);
  await mockApi(page, {
    user: globalAdminUser,
    adminTenants: [
      {
        id: "tenant-1",
        name: "Igreja Central",
        createdAt: "2026-01-01T00:00:00.000Z",
        _count: { users: 2, ministries: 1, schedules: 3, instruments: 4 },
      },
    ],
  });
  await page.goto("/");

  await login(page, "global@example.com");
  await page.getByTestId("header-profile-button").last().click();
  await page.getByTestId("open-global-admin-button").click();

  await expect(page.getByText("Operação global", { exact: true })).toBeVisible();
  await expect(page.getByText("Igrejas", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Igreja Central").first()).toBeVisible();
  await expect(page.getByText("2 usuários")).toBeVisible();
  await expect(page.getByText("1 ministério")).toBeVisible();

  await page.getByText("Usuários", { exact: true }).first().click();
  await expect(page.getByText("Usuários", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Gael Global").last()).toBeVisible();
  await expect(page.getByText("GLOBAL_ADMIN", { exact: true })).toBeVisible();

  await page.getByText("Ministérios", { exact: true }).first().click();
  await expect(page.getByText("Ministérios", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Louvor", { exact: true })).toBeVisible();
  await expect(page.getByText("Não foi possível carregar o painel global.")).not.toBeVisible();
  await expect(page.getByText("0 usuários")).not.toBeVisible();
  expect(adminTenantsRequest?.url()).toContain("/api/admin/tenants");
  expect(adminTenantsRequest?.headers().authorization).toBe(`Bearer ${token}`);
});

test("mobile permite rolar os atalhos e mantém os campos do Painel Global separados", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.unroute("**/api/auth/login").catch(() => undefined);
  await page.unroute("**/api/members/me").catch(() => undefined);
  await mockApi(page, { user: globalAdminUser });
  await page.goto("/");
  await login(page, "global@example.com");

  await page.getByRole("tab", { name: "Mais" }).click();
  const globalShortcut = page.getByRole("button", { name: "Abrir Painel Global" });
  await globalShortcut.scrollIntoViewIfNeeded();
  await globalShortcut.click();

  await page.getByTestId("global-resource-users").click();
  const row = page.getByTestId("global-admin-row-global-1");
  await expect(row).toBeVisible();

  const cellBounds = await row.locator('[data-testid^="global-admin-cell-global-1-"]').evaluateAll((cells) =>
    cells.map((cell) => {
      const bounds = cell.getBoundingClientRect();
      return { top: bounds.top, bottom: bounds.bottom, height: bounds.height };
    })
  );

  expect(cellBounds).toHaveLength(4);
  for (const bounds of cellBounds) {
    expect(bounds.height).toBeGreaterThan(30);
  }
  for (let index = 1; index < cellBounds.length; index += 1) {
    expect(cellBounds[index].top).toBeGreaterThanOrEqual(cellBounds[index - 1].bottom + 8);
  }
});

test("GLOBAL_ADMIN vê erro claro quando API global falha", async ({ page }) => {
  await page.unroute("**/api/auth/login").catch(() => undefined);
  await page.unroute("**/api/members/me").catch(() => undefined);
  await page.unroute("**/api/admin/tenants**").catch(() => undefined);
  await mockApi(page, { user: globalAdminUser, adminTenantsError: true });
  await page.goto("/");

  await login(page, "global@example.com");
  await page.getByTestId("header-profile-button").last().click();
  await page.getByTestId("open-global-admin-button").click();
  await expect(page.getByText("Não foi possível carregar o painel global.").first()).toBeVisible();
});

test("GLOBAL_ADMIN nega uma permissão herdada pelo controle de três estados", async ({ page }) => {
  let savedOverrides: Array<{ permissionKey: string; effect: string }> | undefined;
  const targetUser = {
    id: "member-2",
    name: "Bruno Membro",
    email: "bruno@example.com",
    role: "MEMBER",
    tenantId: "tenant-2",
    tenant: { id: "tenant-2", name: "Igreja Norte" },
    createdAt: "2026-05-26T00:00:00.000Z",
  };
  const memberView = {
    id: "permission-member-view",
    key: "member:view",
    description: "Visualizar membros",
    category: "Membros",
    assignable: true,
  };

  await mockApi(page, { user: globalAdminUser, adminUsers: [targetUser] });
  await page.route("**/api/admin/permissions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [
          memberView,
          {
            id: "permission-manage",
            key: "permissions:manage",
            description: "Gerenciar permissões granulares",
            category: "Admin",
            assignable: false,
          },
        ],
      }),
    });
  });
  await page.route("**/api/admin/users/member-2/permissions", async (route) => {
    const isUpdate = route.request().method() === "PUT";
    if (isUpdate) {
      savedOverrides = (route.request().postDataJSON() as { overrides: Array<{ permissionKey: string; effect: string }> }).overrides;
    }
    const denyOverride = isUpdate
      ? [{
          id: "override-1",
          userId: targetUser.id,
          tenantId: targetUser.tenantId,
          permissionId: memberView.id,
          permission: memberView,
          grantedById: globalAdminUser.id,
          effect: "DENY",
          createdAt: "2026-07-13T00:00:00.000Z",
        }]
      : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          user: targetUser,
          grants: [],
          baseline: ["member:view"],
          overrides: denyOverride,
          effective: isUpdate ? [] : ["member:view"],
        },
      }),
    });
  });

  await page.goto("/");
  await login(page, "global@example.com");
  await page.getByTestId("header-profile-button").last().click();
  await page.getByTestId("open-global-admin-button").click();
  await page.getByText("Usuários", { exact: true }).first().click();
  const managePermissionsButton = page.locator('button[aria-label="Gerenciar permissões granulares"]:visible');
  await managePermissionsButton.first().click();

  const memberViewControl = page.getByLabel("Visualizar membros");
  await expect(memberViewControl).toBeVisible();
  await expect(page.getByText("permissions:manage", { exact: true })).toHaveCount(0);
  await memberViewControl.click();
  await memberViewControl.click();
  await expect(page.getByText("Negado", { exact: true })).toBeVisible();
  await page.getByText("Salvar permissões", { exact: true }).click();

  await expect.poll(() => savedOverrides).toEqual([{ permissionKey: "member:view", effect: "DENY" }]);
});

test("painel global exibe empty state apenas quando API retorna banco vazio", async ({ page }) => {
  await page.unroute("**/api/auth/login").catch(() => undefined);
  await page.unroute("**/api/members/me").catch(() => undefined);
  await page.unroute("**/api/admin/tenants**").catch(() => undefined);
  await mockApi(page, { user: globalAdminUser, adminTenants: [] });
  await page.evaluate(() => window.localStorage.clear());
  await page.goto("/");

  await login(page, "global@example.com");
  await page.getByTestId("header-profile-button").last().click();
  await page.getByTestId("open-global-admin-button").click();
  await expect(page.getByText("Nenhum registro encontrado", { exact: true })).toBeVisible();
});

test("valida cadastro e conclui fluxo de primeiro administrador", async ({ page }) => {
  await page.getByTestId("go-register").click();
  await expect(page.getByText("Crie sua igreja", { exact: true })).toBeVisible();

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
  await page.getByTestId("register-confirm").press("Enter");

  await expect(page.getByText("Maria Admin", { exact: true })).toBeVisible();
  const storage = await page.evaluate(() => ({ ...window.localStorage }));
  expect(JSON.stringify(storage)).not.toContain("secret123");
  expect(storage.auth_tenant).toContain("Igreja Central");
});

test("cadastra um novo membro ao pressionar Enter", async ({ page }) => {
  let createPayload: { name?: string; email?: string } | undefined;
  await page.route("**/api/members", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    createPayload = route.request().postDataJSON() as {
      name?: string;
      email?: string;
    };
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          ...memberUser,
          id: "member-created-with-enter",
          name: createPayload.name,
          email: createPayload.email,
        },
      }),
    });
  });

  await login(page);
  await page.getByRole("button", { name: "Convidar membro" }).click();
  await expect(page.getByText("Novo membro", { exact: true })).toBeVisible();
  await page.getByPlaceholder("Nome completo").fill("Carlos Membro");
  await page.getByPlaceholder("membro@suaigreja.com").fill("carlos@example.com");
  await page.getByPlaceholder("Mínimo 6 caracteres").fill("secret123");
  await page.getByPlaceholder("Mínimo 6 caracteres").press("Enter");

  await expect.poll(() => createPayload?.email).toBe("carlos@example.com");
  await expect(page.getByText("Membro cadastrado com sucesso.")).toBeVisible();
});

test("permite sair da conta e limpa a sessão local", async ({ page }) => {
  await login(page);
  await page.getByTestId("header-profile-button").last().click();

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
  await page.getByTestId("header-profile-button").last().click();

  await expect(page.getByText("Meus instrumentos/cargos")).toBeVisible();
  await expect(page.getByText("Teclado").first()).toBeVisible();
  await expect(page.getByText("instrument-1")).not.toBeVisible();
});

test("edita dados do perfil pelo acesso no cabeçalho", async ({ page }) => {
  let payload: { name?: string; phone?: string | null; avatarUrl?: string | null } | undefined;
  await page.unroute("**/api/members/me/profile");
  await page.route("**/api/members/me/profile", async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { ...adminUser, ...payload } }) });
  });

  await login(page);
  await page.getByTestId("header-profile-button").last().click();
  await expect(page.getByTestId("profile-avatar-picker")).toBeVisible();
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByTestId("profile-avatar-picker").click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({ name: "avatar.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+Mnp5WQAAAABJRU5ErkJggg==", "base64") });
  await expect(page.getByText("Remover foto")).toBeVisible();
  await page.getByTestId("profile-name-input").fill("Ana Atualizada");
  await page.getByTestId("profile-phone-input").fill("11999990000");
  await page.getByTestId("profile-save-button").click();

  await expect.poll(() => payload?.name).toBe("Ana Atualizada");
  expect(payload?.phone).toBe("11999990000");
  expect(payload?.avatarUrl).toMatch(/^data:image\/png;base64,/);
  await expect(page.getByTestId("header-profile-button").last()).toBeVisible();
});

test("abre seletor de instrumentos e permite fechar", async ({ page }) => {
  await login(page);
  await page.getByTestId("header-profile-button").last().click();

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
  await page.getByTestId("header-profile-button").last().click();

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

  page.on("request", (request) => {
    if (
      request.method() === "PATCH" &&
      new URL(request.url()).pathname === "/api/members/me/instruments"
    ) {
      updateRequests += 1;
      lastPayload = request.postDataJSON() as { instrumentIds?: string[] };
    }
  });

  await page.unroute("**/api/auth/login").catch(() => undefined);
  await page.unroute("**/api/members/me").catch(() => undefined);
  await page.unroute("**/api/members/me/instruments").catch(() => undefined);
  await page.unroute("**/api/members/*/instruments").catch(() => undefined);
  await mockApi(page, { user: memberUser });
  await page.goto("/");

  await login(page, "bruno@example.com");
  await page.getByTestId("header-profile-button").last().click();

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
