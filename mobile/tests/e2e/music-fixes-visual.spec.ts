import { expect, test, type Page } from "@playwright/test";

const permissions = [
  "schedule:view", "schedule:create", "schedule:edit", "schedule:delete", "schedule:assign_members",
  "schedule:respond", "schedule:view_reports", "song:create", "song:view", "song:edit", "song:delete",
  "song:attach_to_schedule", "ministry:view", "member:view",
];

const artists = [
  { id: "artist-1", name: "Harpa Cristã", imageUrl: null, createdAt: "", updatedAt: "" },
  { id: "artist-2", name: "Morada", imageUrl: null, createdAt: "", updatedAt: "" },
  { id: "artist-3", name: "Diante do Trono", imageUrl: null, createdAt: "", updatedAt: "" },
];

const songs = [
  { id: "song-1", title: "Firme nas Promessas", composer: null, originalKey: "G", content: "[G]Firme nas promessas do meu Salvador", bpm: 96, artistId: "artist-1", artist: artists[0], createdAt: "", updatedAt: "" },
  { id: "song-2", title: "Só Tu És Santo", composer: null, originalKey: "A", content: "[A]Só Tu és Santo", bpm: null, artistId: "artist-2", artist: artists[1], createdAt: "", updatedAt: "" },
  { id: "song-3", title: "Te Agradeço", composer: null, originalKey: "D", content: "[D]Eu te agradeço, Deus", bpm: 90, artistId: "artist-3", artist: artists[2], createdAt: "", updatedAt: "" },
];

const schedule = {
  id: "schedule-1",
  title: "Culto de Oração",
  date: "2026-07-13T22:30:00.000Z",
  ministryId: "ministry-1",
  tenantId: "tenant-1",
  ministry: { id: "ministry-1", name: "Louvor IBC" },
  songs: songs.map((song, order) => ({ id: `ss-${order + 1}`, scheduleId: "schedule-1", songId: song.id, order, song })),
  assignments: [],
};

async function mockAuthenticatedApp(page: Page) {
  await page.addInitScript(({ effectivePermissions }) => {
    localStorage.setItem("auth_token", "visual-token");
    localStorage.setItem("refresh_token", "visual-refresh");
    localStorage.setItem("auth_user", JSON.stringify({
      id: "admin-1",
      name: "Administrador Visual",
      email: "visual@lauda.test",
      role: "TENANT_ADMIN",
      tenantId: "tenant-1",
      permissions: effectivePermissions,
    }));
    localStorage.setItem("auth_tenant", JSON.stringify({ id: "tenant-1", name: "Igreja Visual" }));
  }, { effectivePermissions: permissions });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === "/api/auth/me") {
      await route.fulfill({ json: { success: true, data: { user: { id: "admin-1", name: "Administrador Visual", email: "visual@lauda.test", role: "TENANT_ADMIN", tenantId: "tenant-1", permissions }, tenant: { id: "tenant-1", name: "Igreja Visual" }, permissions } } });
      return;
    }
    if (path === "/api/schedules/me") {
      await route.fulfill({ json: { success: true, data: [] } });
      return;
    }
    if (path === "/api/schedules") {
      await route.fulfill({ json: { success: true, data: [schedule] } });
      return;
    }
    if (path === "/api/ministries") {
      await route.fulfill({ json: { success: true, data: [{ id: "ministry-1", name: "Louvor IBC", tenantId: "tenant-1", createdAt: "" }] } });
      return;
    }
    if (path === "/api/ministries/ministry-1/members") {
      await route.fulfill({ json: { success: true, data: { items: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } } } });
      return;
    }
    if (path === "/api/members") {
      await route.fulfill({ json: { success: true, data: [] } });
      return;
    }
    if (path === "/api/artists") {
      const search = (url.searchParams.get("search") ?? "").toLocaleLowerCase("pt-BR");
      const items = search ? artists.filter((artist) => artist.name.toLocaleLowerCase("pt-BR").includes(search)) : artists;
      await route.fulfill({ json: { success: true, data: { items, pagination: { page: 1, limit: 10, total: items.length, totalPages: items.length ? 1 : 0 } } } });
      return;
    }
    if (path === "/api/songs/song-1") {
      await route.fulfill({ json: { success: true, data: songs[0] } });
      return;
    }
    if (path === "/api/songs") {
      const search = (url.searchParams.get("search") ?? "").toLocaleLowerCase("pt-BR");
      const items = search
        ? songs.filter((song) => `${song.title} ${song.artist.name}`.toLocaleLowerCase("pt-BR").includes(search))
        : songs;
      await route.fulfill({ json: { success: true, data: { items, pagination: { page: 1, limit: 100, total: items.length, totalPages: items.length ? 1 : 0 } } } });
      return;
    }
    await route.fulfill({ json: { success: true, data: [] } });
  });
}

test("revisão visual das correções de músicas e escalas", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 820 });
  await mockAuthenticatedApp(page);

  await page.goto("/");
  await page.getByTestId("sidebar-nav-schedules").click();
  await expect(page).toHaveURL(/\/schedules$/);
  await page.getByText("13", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Exportar cifras da escala Culto de Oração" })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "../dogfood-output/music-fixes-20260713/screenshots/schedules-list-after.png", fullPage: true });

  await page.getByRole("button", { name: "Editar escala Culto de Oração" }).last().click();
  await expect(page.getByRole("button", { name: "Exportar cifras da escala" })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "../dogfood-output/music-fixes-20260713/screenshots/schedule-edit-after.png", fullPage: true });

  await page.getByText("Editar músicas", { exact: true }).click();
  const scheduleSearch = page.getByTestId("schedule-song-search-input");
  await expect(scheduleSearch).toBeVisible();
  await scheduleSearch.fill("Diante do Trono");
  await expect(page.getByText("Te Agradeço", { exact: true })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "../dogfood-output/music-fixes-20260713/screenshots/schedule-song-search-after.png", fullPage: true });

  await page.getByRole("button", { name: "Voltar" }).last().click();
  await page.getByTestId("sidebar-nav-songs").click();
  await expect(page).toHaveURL(/\/songs$/);
  await page.getByLabel("Nova música").click();
  await page.getByTestId("artist-search-input").fill("Novo Artista Visual");
  await expect(page.getByText("Criar “Novo Artista Visual”", { exact: true })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "../dogfood-output/music-fixes-20260713/screenshots/artist-create-after.png", fullPage: true });

  await page.goto("/");
  await page.getByTestId("sidebar-nav-songs").click();
  await page.getByText("Firme nas Promessas", { exact: true }).click();
  await expect(page.getByTestId("transpose-down")).toHaveText("−1 Tom");
  await expect(page.getByTestId("font-down")).toHaveText("A−");
  await expect(page.getByTestId("scroll-speed")).toHaveText("1.00×");
  await page.waitForTimeout(400);
  await page.screenshot({ path: "../dogfood-output/music-fixes-20260713/screenshots/song-controls-after.png", fullPage: true });
});

test("revisão responsiva das ações e da busca de cifras", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAuthenticatedApp(page);

  await page.goto("/");
  await page.getByText("Escalas", { exact: true }).last().click();
  await page.getByRole("button", { name: /Selecionar .* 13 de/ }).click();
  await expect(page.getByRole("button", { name: "Exportar cifras da escala Culto de Oração" })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "../dogfood-output/music-fixes-20260713/screenshots/schedules-list-mobile-after.png", fullPage: true });

  await page.getByText("Nova Escala", { exact: true }).click();
  await expect(page).toHaveURL(/\/schedules\/new(?:\?.*)?$/);
  await page.waitForTimeout(400);
  await page.screenshot({ path: "../dogfood-output/music-fixes-20260713/screenshots/schedule-new-mobile-after.png", fullPage: true });
  await page.goBack();
  await page.getByText("Escalas", { exact: true }).last().click();
  await expect(page).toHaveURL(/\/schedules$/);
  await page.getByRole("button", { name: /Selecionar .* 13 de/ }).click();

  await page.getByRole("button", { name: "Editar escala Culto de Oração" }).last().click();
  await expect(page.getByRole("button", { name: "Exportar cifras da escala" })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "../dogfood-output/music-fixes-20260713/screenshots/schedule-edit-mobile-after.png", fullPage: true });
  await page.getByText("Editar músicas", { exact: true }).click();
  const scheduleSearch = page.getByTestId("schedule-song-search-input");
  await expect(scheduleSearch).toBeVisible();
  await scheduleSearch.fill("Diante do Trono");
  await expect(page.getByText("Te Agradeço", { exact: true })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "../dogfood-output/music-fixes-20260713/screenshots/schedule-song-search-mobile-after.png", fullPage: true });
});

test("exclusão de escala usa modal personalizado no navegador", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 820 });
  await mockAuthenticatedApp(page);
  await page.goto("/");
  await page.getByTestId("sidebar-nav-schedules").click();
  await page.getByText("13", { exact: true }).click();
  await page.getByRole("button", { name: "Editar escala Culto de Oração" }).last().click();

  await page.getByRole("button", { name: "Excluir escala", exact: true }).click();
  const modal = page.getByTestId("delete-schedule-modal");
  await expect(modal).toBeVisible();
  await expect(modal.getByText("Excluir escala?", { exact: true })).toBeVisible();
  await expect(modal.getByText("Culto de Oração", { exact: true })).toBeVisible();

  await modal.getByRole("button", { name: "Manter escala" }).click();
  await expect(modal).toBeHidden();

  await page.getByRole("button", { name: "Excluir escala", exact: true }).click();
  const deleteRequest = page.waitForRequest((request) => request.method() === "DELETE" && request.url().endsWith("/api/schedules/schedule-1"));
  await modal.getByRole("button", { name: "Confirmar exclusão da escala" }).click();
  await deleteRequest;
  await expect(page).toHaveURL(/\/schedules$/);
});
