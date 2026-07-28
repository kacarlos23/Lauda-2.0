import { expect, test, type ConsoleMessage, type Page, type TestInfo } from "@playwright/test";
import { materializeRoutePath, ROUTES, type RouteKey } from "../../src/navigation/routes";

const sampleId = "123e4567-e89b-12d3-a456-426614174000";
const routes = (Object.keys(ROUTES) as RouteKey[]).map((key) => [
  materializeRoutePath(key, sampleId),
  ROUTES[key].documentTitle,
] as const);

const publicRoutes = routes.slice(0, 6);

function collectBrowserErrors(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message: ConsoleMessage) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  return { pageErrors, consoleErrors };
}

test("os 26 HTMLs exportados têm um único título específico e não vazio", async ({ request }) => {
  for (const [route, title] of routes) {
    const response = await request.get(route);
    expect(response.status(), `${route} deve responder com sucesso`).toBe(200);
    const html = await response.text();
    const titles = [...html.matchAll(/<title[^>]*>(.*?)<\/title>/g)].map((match) => match[1]);
    expect(titles, `${route} deve conter somente um title`).toEqual([title]);
  }
});

for (const [route, title] of publicRoutes) {
  test(`hard reload de ${route} hidrata sem erro e preserva o título`, async ({ page }) => {
    const browserErrors = collectBrowserErrors(page);
    await page.goto(route, { waitUntil: "networkidle" });
    await page.reload({ waitUntil: "networkidle" });

    await expect(page).toHaveTitle(title);
    await expect(page.locator("head > title")).toHaveCount(1);
    expect(browserErrors.pageErrors, `erros de página em ${route}`).toEqual([]);
    expect(browserErrors.consoleErrors, `erros de console em ${route}`).toEqual([]);
  });
}

const permissions = [
  "schedule:view",
  "schedule:create",
  "schedule:edit",
  "schedule:delete",
  "schedule:assign_members",
  "schedule:respond",
  "schedule:view_reports",
  "song:view",
];

const user = {
  id: "admin-1",
  name: "Ana Admin",
  email: "ana@lauda.test",
  role: "TENANT_ADMIN",
  tenantId: "tenant-1",
  permissions,
};

const tenant = { id: "tenant-1", name: "Igreja Central" };

function scheduleForToday() {
  const date = new Date();
  date.setHours(10, 30, 0, 0);
  return {
    id: "schedule-1",
    title: "Culto de celebração",
    date: date.toISOString(),
    ministryId: "ministry-1",
    tenantId: tenant.id,
    ministry: { id: "ministry-1", name: "Louvor" },
    assignments: [
      {
        id: "assignment-1",
        scheduleId: "schedule-1",
        userId: user.id,
        role: "Vocal",
        status: "PENDING",
        tenantId: tenant.id,
        user,
      },
    ],
    songs: [],
  };
}

async function prepareSchedules(page: Page) {
  const schedule = scheduleForToday();
  const assignment = { ...schedule.assignments[0], schedule };

  await page.addInitScript(({ currentUser, currentTenant }) => {
    localStorage.setItem("auth_token", "static-render-token");
    localStorage.setItem("refresh_token", "static-render-refresh");
    localStorage.setItem("auth_user", JSON.stringify(currentUser));
    localStorage.setItem("auth_tenant", JSON.stringify(currentTenant));
  }, { currentUser: user, currentTenant: tenant });

  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") {
      await route.fulfill({ json: { success: true, data: { user, tenant, permissions } } });
      return;
    }
    if (path === "/api/schedules/me") {
      await route.fulfill({ json: { success: true, data: [assignment] } });
      return;
    }
    if (path === "/api/schedules") {
      await route.fulfill({ json: { success: true, data: [schedule] } });
      return;
    }
    await route.fulfill({ json: { success: true, data: [] } });
  });
}

async function openSchedulesWithoutErrors(page: Page) {
  const browserErrors = collectBrowserErrors(page);
  await prepareSchedules(page);
  await page.goto("/schedules", { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" });
  await expect(page).toHaveTitle("Escalas | Lauda");
  await expect(page.locator("head > title")).toHaveCount(1);
  expect(browserErrors.pageErrors).toEqual([]);
  expect(browserErrors.consoleErrors).toEqual([]);
}

test("Escalas desktop segue calendário + agenda em duas colunas", async ({ page }, testInfo: TestInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openSchedulesWithoutErrors(page);

  const calendar = page.getByTestId("schedule-calendar-panel");
  const agenda = page.getByTestId("schedule-agenda-panel");
  await expect(calendar).toBeVisible();
  await expect(agenda).toBeVisible();
  await expect(page.getByText("Agenda do dia", { exact: true })).toBeVisible();

  const calendarBox = await calendar.boundingBox();
  const agendaBox = await agenda.boundingBox();
  expect(calendarBox).not.toBeNull();
  expect(agendaBox).not.toBeNull();
  expect(Math.abs((calendarBox?.y ?? 0) - (agendaBox?.y ?? 0))).toBeLessThanOrEqual(2);
  expect(agendaBox?.x ?? 0).toBeGreaterThan((calendarBox?.x ?? 0) + (calendarBox?.width ?? 0));

  await page.screenshot({ path: testInfo.outputPath("schedules-desktop.png"), fullPage: true });
});

test("Escalas mobile mantém calendário e agenda empilhados", async ({ page }, testInfo: TestInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSchedulesWithoutErrors(page);

  await expect(page.getByTestId("schedule-calendar-panel")).toBeVisible();
  await expect(page.getByTestId("schedule-agenda-panel")).toHaveCount(0);
  await expect(page.getByText("Escalas do dia", { exact: true })).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath("schedules-mobile.png"), fullPage: true });
});
