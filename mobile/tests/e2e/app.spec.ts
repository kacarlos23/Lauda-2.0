import { expect, test, type Page, type Request } from "@playwright/test";

const adminUser = {
  id: "user-1",
  name: "Ana Admin",
  email: "ana@example.com",
  role: "TENANT_ADMIN",
  tenantId: "tenant-1",
};

const tenant = {
  id: "tenant-1",
  name: "Igreja Central",
};

const token = "test.jwt.token";
const refreshToken = "test.refresh.token";

const defaultSchedules = [
  {
    assignmentId: "assignment-1",
    status: "PENDING",
    role: "Vocal",
    schedule: {
      id: "schedule-1",
      title: "Culto de domingo",
      date: "2026-05-24T13:00:00.000Z",
      ministryId: "ministry-1",
      ministry: { id: "ministry-1", name: "Louvor" },
    },
  },
  {
    assignmentId: "assignment-2",
    status: "ACCEPTED",
    role: "Recepção",
    schedule: {
      id: "schedule-2",
      title: "Reunião de oração",
      date: "2026-05-27T22:00:00.000Z",
      ministryId: "ministry-2",
      ministry: { id: "ministry-2", name: "Acolhimento" },
    },
  },
];

async function mockApi(
  page: Page,
  options: { loginFails?: boolean; schedules?: typeof defaultSchedules; schedulesError?: boolean; schedulesDelayMs?: number } = {}
) {
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
        data: { token, accessToken: token, refreshToken, user: { ...adminUser, email: body.email }, tenant },
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
          accessToken: token,
          refreshToken,
          user: { ...adminUser, name: body.name ?? adminUser.name, email: body.email ?? adminUser.email },
          tenant,
        },
      }),
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
      body: JSON.stringify({ data: [adminUser] }),
    });
  });

  await page.route("**/api/schedules/me", async (route) => {
    if (options.schedulesDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.schedulesDelayMs));
    }

    if (options.schedulesError) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Erro ao carregar escalas" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: options.schedules ?? defaultSchedules }),
    });
  });

  await page.route("**/api/schedules/*/assignments/*/status", async (route) => {
    const body = route.request().postDataJSON() as { status?: string };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          ...defaultSchedules[0],
          status: body.status,
        },
      }),
    });
  });
}

async function login(page: Page, email = "ana@example.com", password = "secret123") {
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page.getByText(/Ana/)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
});

test("redireciona usuário anonimo para login e bloqueia area autenticada", async ({ page }) => {
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

test("faz login, envia token em requisicoes protegidas e não persiste senha", async ({ page }) => {
  let ministriesRequest: Request | undefined;
  page.on("request", (request) => {
    if (request.url().includes("/api/ministries")) ministriesRequest = request;
  });

  await login(page);
  await page.getByRole("tab", { name: /Ministérios/ }).click();

  await expect(page.getByText("Louvor", { exact: true })).toBeVisible();
  expect(ministriesRequest?.headers().authorization).toBe(`Bearer ${token}`);

  const storage = await page.evaluate(() => ({ ...window.localStorage }));
  expect(JSON.stringify(storage)).not.toContain("secret123");
  expect(storage.auth_token).toBe(token);
});

test("Home mostra igreja atual e resumo real das próximas escalas", async ({ page }) => {
  await login(page);

  await expect(page.getByText("Igreja atual: Igreja Central").last()).toBeVisible();
  await expect(page.getByText("Escalas pendentes")).toBeVisible();
  await expect(page.getByText("Culto de domingo").last()).toBeVisible();
  await expect(page.getByText(/Louvor/)).toBeVisible();
  await expect(page.getByText("Status: Pendente")).toBeVisible();
  await expect(page.getByText("PENDING")).toHaveCount(0);
});

test("aba Escalas renderiza igreja, lista, status traduzido e botões só para pendentes", async ({ page }) => {
  await login(page);
  await page.getByRole("tab", { name: /Escalas/ }).click();

  await expect(page.getByText("Igreja atual: Igreja Central").last()).toBeVisible();
  await expect(page.getByText("Minhas escalas", { exact: true })).toBeVisible();
  await expect(page.getByText("Culto de domingo").last()).toBeVisible();
  await expect(page.getByText("Louvor", { exact: true })).toBeVisible();
  await expect(page.getByText("Vocal", { exact: true })).toBeVisible();
  await expect(page.getByText("Pendente", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("Reunião de oração")).toBeVisible();
  await expect(page.getByText("Aceita", { exact: true })).toBeVisible();
  await expect(page.getByText("ACCEPTED")).toHaveCount(0);
  await expect(page.getByText("Aceitar")).toHaveCount(1);
  await expect(page.getByText("Recusar")).toHaveCount(1);
});

test("permite aceitar uma escala pendente pela aba Escalas", async ({ page }) => {
  let patchStatus: string | undefined;
  page.on("request", (request) => {
    if (request.url().includes("/api/schedules/schedule-1/assignments/assignment-1/status")) {
      patchStatus = (request.postDataJSON() as { status?: string }).status;
    }
  });

  await login(page);
  await page.getByRole("tab", { name: /Escalas/ }).click();
  await page.getByText("Aceitar").click();

  await expect(page.getByText("Aceita", { exact: true }).last()).toBeVisible();
  expect(patchStatus).toBe("ACCEPTED");
});

test("permite recusar uma escala pendente pela aba Escalas", async ({ page }) => {
  let patchStatus: string | undefined;
  page.on("request", (request) => {
    if (request.url().includes("/api/schedules/schedule-1/assignments/assignment-1/status")) {
      patchStatus = (request.postDataJSON() as { status?: string }).status;
    }
  });

  await login(page);
  await page.getByRole("tab", { name: /Escalas/ }).click();
  await page.getByText("Recusar").click();

  await expect(page.getByText("Recusada", { exact: true })).toBeVisible();
  expect(patchStatus).toBe("DECLINED");
});

test("aba Escalas renderiza estado vazio", async ({ page }) => {
  await mockApi(page, { schedules: [] });
  await page.goto("/");
  await login(page);
  await page.getByRole("tab", { name: /Escalas/ }).click();

  await expect(page.getByText("Nenhuma escala encontrada")).toBeVisible();
});

test("aba Escalas renderiza erro com opção de tentar novamente", async ({ page }) => {
  await mockApi(page, { schedulesError: true });
  await page.goto("/");
  await login(page);
  await page.getByRole("tab", { name: /Escalas/ }).click();

  await expect(page.getByText("Erro ao carregar escalas")).toBeVisible();
  await expect(page.getByText("Tentar novamente")).toBeVisible();
});

test("aba Escalas renderiza loading", async ({ page }) => {
  await mockApi(page, { schedulesDelayMs: 1000 });
  await page.goto("/");
  await login(page);
  await page.getByRole("tab", { name: /Escalas/ }).click();

  await expect(page.getByText("Carregando escalas...")).toBeVisible();
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
  await page.getByTestId("logout-submit").click();

  await expect(page.getByTestId("login-email")).toBeVisible();
  const storage = await page.evaluate(() => ({ ...window.localStorage }));
  expect(storage.auth_token).toBeUndefined();
  expect(storage.auth_user).toBeUndefined();
});
