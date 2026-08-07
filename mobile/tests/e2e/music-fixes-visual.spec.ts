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
  { id: "song-cifra-only", title: "Graça Infinita", composer: null, originalKey: "C", content: "[C]Graça infinita", bpm: null, artistId: "artist-1", artist: artists[0], cifraUrl: "https://example.com/cifra-only", createdAt: "", updatedAt: "" },
  { id: "song-two-links", title: "Casa do Pai", composer: null, originalKey: "E", content: "[E]Casa do Pai", bpm: 84, artistId: "artist-2", artist: artists[1], cifraUrl: "https://example.com/cifra-two", videoUrl: "https://example.com/video-two", createdAt: "", updatedAt: "" },
  {
    id: "song-all-links",
    title: "Ajuda-me a Vencer",
    composer: null,
    originalKey: "G",
    content: "[G]Ajuda-me a vencer",
    bpm: null,
    artistId: "artist-test",
    artist: { id: "artist-test", name: "Ipalp", imageUrl: null, createdAt: "", updatedAt: "" },
    cifraUrl: "https://example.com/cifra",
    letraUrl: "https://example.com/letra",
    audioUrl: "https://example.com/audio",
    videoUrl: "https://example.com/video",
    createdAt: "",
    updatedAt: "",
  },
];

const scheduleDate = new Date();
scheduleDate.setDate(13);
scheduleDate.setHours(19, 30, 0, 0);

const schedule = {
  id: "schedule-1",
  title: "Culto de Oração",
  date: scheduleDate.toISOString(),
  ministryId: "ministry-1",
  tenantId: "tenant-1",
  ministry: { id: "ministry-1", name: "Louvor IBC" },
  songs: songs.slice(0, 3).map((song, order) => ({ id: `ss-${order + 1}`, scheduleId: "schedule-1", songId: song.id, order, song })),
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
  await expect(page.getByRole("button", { name: "Selecionar música Te Agradeço" })).toBeVisible();
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
  await expect(page.getByRole("button", { name: "Selecionar música Te Agradeço" })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "../dogfood-output/music-fixes-20260713/screenshots/schedule-song-search-mobile-after.png", fullPage: true });
});

test("links de músicas são consolidados no conteúdo estreito", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await mockAuthenticatedApp(page);

  await page.goto("/");
  await page.getByText("Músicas", { exact: true }).last().click();
  await expect(page).toHaveURL(/\/songs$/);

  const noLinksRow = page.getByTestId("song-row-song-1");
  await expect(noLinksRow.getByTestId("song-link-buttons")).toHaveCount(0);
  await expect(noLinksRow.getByTestId("song-links-trigger")).toHaveCount(0);

  const oneLinkRow = page.getByTestId("song-row-song-cifra-only");
  await expect(oneLinkRow.getByRole("link", { name: "Abrir link de cifra" })).toBeVisible();
  await expect(oneLinkRow.getByText("Cifra", { exact: true })).toBeVisible();
  await expect(oneLinkRow.getByText("Links 1", { exact: true })).toHaveCount(0);

  const twoLinksRow = page.getByTestId("song-row-song-two-links");
  const twoLinksTrigger = twoLinksRow.getByTestId("song-links-trigger");
  await expect(twoLinksTrigger).toHaveText("Links 2");
  await expect(twoLinksRow.getByRole("link")).toHaveCount(0);
  await twoLinksTrigger.click();
  await expect(page).toHaveURL(/\/songs$/);
  await expect(page.getByText("Links da música", { exact: true })).toBeVisible();

  let sheet = page.getByTestId("song-links-sheet");
  await expect(sheet.getByRole("link", { name: "Abrir link de cifra" })).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Abrir link de vídeo" })).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Abrir link de letra" })).toHaveCount(0);
  await page.getByRole("button", { name: "Fechar" }).click();
  await expect(page.getByTestId("song-links-sheet")).toHaveCount(0);

  const allLinksRow = page.getByTestId("song-row-song-all-links");
  const songTitle = allLinksRow.getByText("Ajuda-me a Vencer", { exact: true });
  const allLinksTrigger = allLinksRow.getByTestId("song-links-trigger");
  await expect(songTitle).toBeVisible();
  await expect(allLinksTrigger).toHaveText("Links 4");

  const [rowBox, titleBox, triggerBox] = await Promise.all([
    allLinksRow.boundingBox(),
    songTitle.boundingBox(),
    allLinksTrigger.boundingBox(),
  ]);
  expect(rowBox).not.toBeNull();
  expect(titleBox).not.toBeNull();
  expect(triggerBox).not.toBeNull();
  expect(rowBox!.height).toBeGreaterThanOrEqual(72);
  expect(rowBox!.height).toBeLessThanOrEqual(80);
  expect(triggerBox!.height).toBeGreaterThanOrEqual(44);
  expect(triggerBox!.x).toBeGreaterThan(titleBox!.x);
  expect(titleBox!.x + titleBox!.width).toBeLessThanOrEqual(triggerBox!.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await allLinksTrigger.click();
  sheet = page.getByTestId("song-links-sheet");
  await expect(page.getByText("Links da música", { exact: true })).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Abrir link de cifra" })).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Abrir link de letra" })).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Abrir link de áudio" })).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Abrir link de vídeo" })).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(allLinksRow.getByTestId("song-links-trigger")).toHaveText("Links 4");
  await expect(allLinksRow.getByText("Ajuda-me a Vencer", { exact: true })).toBeVisible();
  expect((await allLinksRow.boundingBox())!.height).toBeLessThanOrEqual(80);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.getByText("Selecionar para PDF", { exact: true }).click();
  await expect(page.getByTestId("song-link-buttons")).toHaveCount(0);
  await expect(page.getByTestId("song-links-trigger")).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Selecionar Ajuda-me a Vencer" }).click();
  await expect(page.getByRole("checkbox", { name: "Desmarcar Ajuda-me a Vencer" })).toBeVisible();
});

test("desktop mantém todos os links de música diretamente na linha", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await mockAuthenticatedApp(page);

  await page.goto("/");
  await page.getByTestId("sidebar-nav-songs").click();
  await expect(page).toHaveURL(/\/songs$/);

  const row = page.getByTestId("song-row-song-all-links");
  await expect(row.getByText("Ajuda-me a Vencer", { exact: true })).toBeVisible();
  await expect(row.getByRole("link")).toHaveCount(4);
  await expect(row.getByRole("link", { name: "Abrir link de cifra" })).toBeVisible();
  await expect(row.getByRole("link", { name: "Abrir link de letra" })).toBeVisible();
  await expect(row.getByRole("link", { name: "Abrir link de áudio" })).toBeVisible();
  await expect(row.getByRole("link", { name: "Abrir link de vídeo" })).toBeVisible();
  await expect(row.getByTestId("song-links-trigger")).toHaveCount(0);
  await expect(row.getByText("Links 4", { exact: true })).toHaveCount(0);

  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(row.getByRole("link")).toHaveCount(4);
  await expect(row.getByTestId("song-links-trigger")).toHaveCount(0);

  // 683 CSS px correspondem à área útil de uma janela de 1366 px com zoom de 200%.
  await page.setViewportSize({ width: 683, height: 384 });
  const zoomedInfo = row.getByTestId("song-info-song-all-links");
  const zoomedActions = row.getByTestId("song-actions-song-all-links");
  await expect(zoomedActions.getByRole("link")).toHaveCount(4);
  await row.scrollIntoViewIfNeeded();
  const [zoomedInfoBox, zoomedActionsBox] = await Promise.all([
    zoomedInfo.boundingBox(),
    zoomedActions.boundingBox(),
  ]);
  expect(zoomedInfoBox).not.toBeNull();
  expect(zoomedActionsBox).not.toBeNull();
  expect(zoomedInfoBox!.x + zoomedInfoBox!.width).toBeLessThanOrEqual(zoomedActionsBox!.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
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
