import { expect, test, type Page } from "@playwright/test";

const permissions = [
  "schedule:view",
  "schedule:create",
  "schedule:edit",
  "schedule:delete",
  "schedule:assign_members",
  "schedule:respond",
  "schedule:view_reports",
  "song:create",
  "song:view",
  "song:edit",
  "song:delete",
];

const user = {
  id: "admin-1",
  name: "Administrador Visual",
  email: "visual@lauda.test",
  role: "TENANT_ADMIN",
  tenantId: "tenant-1",
  permissions,
};

const tenant = { id: "tenant-1", name: "Igreja Visual" };
const song = {
  id: "song-1",
  title: "Canção de Teste",
  composer: null,
  originalKey: "G",
  content: "[G]Teste",
  bpm: 96,
  artistId: "artist-1",
  artist: { id: "artist-1", name: "Artista Teste", imageUrl: null },
  createdAt: "",
  updatedAt: "",
};

async function prepareAuthenticatedApp(page: Page) {
  await page.addInitScript(({ currentUser, currentTenant }) => {
    localStorage.setItem("auth_token", "visual-token");
    localStorage.setItem("refresh_token", "visual-refresh");
    localStorage.setItem("auth_user", JSON.stringify(currentUser));
    localStorage.setItem("auth_tenant", JSON.stringify(currentTenant));
  }, { currentUser: user, currentTenant: tenant });

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/me") {
      await route.fulfill({ json: { success: true, data: { user, tenant, permissions } } });
      return;
    }
    if (url.pathname === "/api/songs") {
      const search = (url.searchParams.get("search") ?? "").trim().toLocaleLowerCase("pt-BR");
      const items = search && !`${song.title} ${song.artist.name}`.toLocaleLowerCase("pt-BR").includes(search) ? [] : [song];
      await route.fulfill({ json: { success: true, data: { items, pagination: { page: 1, limit: 20, total: items.length, totalPages: items.length ? 1 : 0 } } } });
      return;
    }
    await route.fulfill({ json: { success: true, data: [] } });
  });
}

test("scroll de Escalas ocupa toda a largura disponível", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 520 });
  await prepareAuthenticatedApp(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Escalas" }).click();
  await expect(page).toHaveURL(/\/schedules$/);
  await expect(page.getByText("Escalas do dia", { exact: true })).toBeVisible();

  const geometry = await page.getByText("Escalas do dia", { exact: true }).evaluate((title) => {
    let element: HTMLElement | null = title as HTMLElement;
    while (element) {
      const style = getComputedStyle(element);
      if (["auto", "scroll"].includes(style.overflowY) && element.scrollHeight > element.clientHeight) {
        const rect = element.getBoundingClientRect();
        return { right: rect.right, viewportRight: window.innerWidth, scrollable: true };
      }
      element = element.parentElement;
    }
    return { right: 0, viewportRight: window.innerWidth, scrollable: false };
  });

  expect(geometry.scrollable).toBe(true);
  expect(Math.abs(geometry.viewportRight - geometry.right)).toBeLessThanOrEqual(1);
});

test("x limpa o filtro de pesquisa de Músicas", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 720 });
  await prepareAuthenticatedApp(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Músicas" }).click();
  await expect(page).toHaveURL(/\/songs$/);

  const search = page.getByRole("textbox", { name: "Buscar músicas" });
  await expect(search).toBeVisible();
  await search.fill("termo inexistente");

  const clearButton = page.getByRole("button", { name: "Limpar pesquisa de músicas" });
  await expect(clearButton).toBeVisible();
  await clearButton.click();

  await expect(search).toHaveValue("");
  await expect(clearButton).toHaveCount(0);
  await expect(page.getByText(song.title, { exact: true })).toBeVisible();
});
