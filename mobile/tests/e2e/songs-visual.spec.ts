import { expect, test, type Page } from "@playwright/test";

const songs = [
  { id: "song-1", title: "Aclame ao Senhor", originalKey: "A", bpm: null, artistId: "artist-1", artist: { id: "artist-1", name: "Diante do Trono", imageUrl: null } },
  { id: "song-2", title: "Aliança / Nele Você Pode Confiar (Pot-pourri)", originalKey: "C", bpm: null, artistId: "artist-2", artist: { id: "artist-2", name: "MORADA", imageUrl: null } },
  { id: "song-3", title: "Autor da minha fé", originalKey: "C", bpm: null, artistId: "artist-3", artist: { id: "artist-3", name: "Grupo Logos", imageUrl: null } },
  { id: "song-4", title: "Bem Mais Que Tudo", originalKey: "G", bpm: 120, artistId: "artist-4", artist: { id: "artist-4", name: "Aline Barros", imageUrl: null } },
  { id: "song-5", title: "Cantai Ao Senhor", originalKey: "A", bpm: null, artistId: "artist-5", artist: { id: "artist-5", name: "Paulo César Baruk", imageUrl: null } },
  { id: "song-6", title: "Chamados Cristãos", originalKey: "D", bpm: null, artistId: "artist-6", artist: { id: "artist-6", name: "Convenção Batista Baiana", imageUrl: null } },
  { id: "song-7", title: "Comunhão", originalKey: "E", bpm: null, artistId: "artist-7", artist: { id: "artist-7", name: "Kleber Lucas", imageUrl: null } },
];
const desktopViewport = process.env.PLAYWRIGHT_VIEWPORT === "desktop";
const screenshotDirectory = process.env.PLAYWRIGHT_BASE_URL
  ? `test-results/deployed${desktopViewport ? "-desktop" : ""}`
  : "test-results/visual";

test.use({ viewport: desktopViewport ? { width: 1200, height: 837 } : { width: 498, height: 760 } });

async function authenticate(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("auth_token", "test.jwt.token");
    localStorage.setItem("refresh_token", "refresh.token");
    localStorage.setItem("auth_user", JSON.stringify({ id: "user-1", name: "Usuário", email: "user@example.com", tenantId: "tenant-1", role: "TENANT_ADMIN" }));
    localStorage.setItem("auth_tenant", JSON.stringify({ id: "tenant-1", name: "Igreja Teste" }));
  });
}

async function mockSongsApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/songs" && request.method() === "GET") {
      const search = (url.searchParams.get("search") ?? "").trim().toLocaleLowerCase("pt-BR");
      const artistId = url.searchParams.get("artistId");
      const originalKey = url.searchParams.get("originalKey");
      const searched = search
        ? songs.filter((song) => `${song.title} ${song.artist.name}`.toLocaleLowerCase("pt-BR").includes(search))
        : songs;
      const items = searched.filter((song) => (!artistId || song.artistId === artistId) && (!originalKey || song.originalKey === originalKey));
      await route.fulfill({
        json: { success: true, data: { items, pagination: { page: 1, limit: 20, total: items.length, totalPages: items.length ? 1 : 0 } } },
      });
      return;
    }
    await route.fulfill({ json: { success: true, data: [] } });
  });
}

async function captureViewport(page: Page, path: string) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await page.screenshot();
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await page.screenshot({ path });
}

async function captureSearchResult(page: Page, path: string) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await page.screenshot({ path, clip: { x: 0, y: 150, width: page.viewportSize()?.width ?? 498, height: 230 } });
}

test("valida visualmente o separador e a busca em tempo real", async ({ page }) => {
  await authenticate(page);
  await mockSongsApi(page);
  await page.goto("/");
  await page.getByRole("tab", { name: "Músicas" })
    .or(page.getByRole("link", { name: "Músicas" }))
    .first()
    .click();

  const search = page.getByRole("textbox", { name: "Buscar músicas" });
  await expect(search).toBeVisible();
  await expect(page.getByLabel("Abrir filtros de músicas")).toBeVisible();
  await expect(page.getByText("Diante do Trono · Tom A", { exact: true })).toBeVisible();
  await expect(page.getByText("Aline Barros · Tom G · 120 BPM", { exact: true })).toBeVisible();
  await expect(page.getByText(/\\u00b7/)).toHaveCount(0);
  await captureViewport(page, `${screenshotDirectory}/songs-list.png`);

  const artistResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/songs" && url.searchParams.get("search") === "Aline Barros";
  });
  await search.fill("Aline Barros");
  await artistResponse;
  await expect(page.getByText("Bem Mais Que Tudo", { exact: true })).toBeVisible();
  await expect(page.getByText("Aclame ao Senhor", { exact: true })).toHaveCount(0);
  await search.blur();
  await captureSearchResult(page, `${screenshotDirectory}/songs-search-artist.png`);

  const titleResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/songs" && url.searchParams.get("search") === "Comunhão";
  });
  await search.fill("Comunhão");
  await titleResponse;
  await expect(page.getByText("Comunhão", { exact: true })).toBeVisible();
  await expect(page.getByText("Bem Mais Que Tudo", { exact: true })).toHaveCount(0);
  await search.blur();
  await search.screenshot({ path: `${screenshotDirectory}/songs-search-title-input.png` });
  await page.getByTestId("song-row-song-7").screenshot({ path: `${screenshotDirectory}/songs-search-title.png` });
});

test("aplica filtro real por tom e mostra o total filtrado", async ({ page }) => {
  await authenticate(page);
  await mockSongsApi(page);
  await page.goto("/");
  await page.getByRole("tab", { name: "Músicas" })
    .or(page.getByRole("link", { name: "Músicas" }))
    .first()
    .click();

  await page.getByLabel("Abrir filtros de músicas").click();
  const filteredResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/songs" && url.searchParams.get("originalKey") === "G";
  });
  await page.getByLabel("Filtrar por tom G", { exact: true }).click();
  await page.getByLabel("Aplicar filtros").click();
  await filteredResponse;

  await expect(page.getByText("1 música encontrada", { exact: true })).toBeVisible();
  await expect(page.getByText("Bem Mais Que Tudo", { exact: true })).toBeVisible();
  await expect(page.getByText("Aclame ao Senhor", { exact: true })).toHaveCount(0);
});

test("alterna o painel pela largura útil e mantém sticky durante a rolagem", async ({ page }) => {
  await page.setViewportSize({ width: 1199, height: 600 });
  await authenticate(page);
  await mockSongsApi(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Músicas" }).click();
  await page.getByText("Selecionar para PDF", { exact: true }).click();

  for (const width of [1199, 1200, 1280]) {
    await page.setViewportSize({ width, height: 600 });
    await expect(page.getByTestId("songs-selection-layout-compact")).toBeVisible();
  }
  for (const width of [1360, 1440]) {
    await page.setViewportSize({ width, height: 600 });
    await expect(page.getByTestId("songs-selection-layout-wide")).toBeVisible();
  }

  await page.getByLabel("Selecionar Aclame ao Senhor").click();
  const panel = page.getByTestId("songs-export-panel-sticky");
  await page.screenshot({ path: `${screenshotDirectory}/songs-selection-wide.png`, fullPage: true });
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(150);
  const firstStickyBox = await panel.boundingBox();
  const stickyStyles = await panel.evaluate((element) => {
    const style = getComputedStyle(element);
    return { position: style.position, top: style.top };
  });
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(150);
  const panelBox = await panel.boundingBox();
  const rowBox = await page.getByTestId("song-row-song-7").boundingBox();
  expect(stickyStyles).toEqual({ position: "sticky", top: "24px" });
  expect(panelBox?.y).toBe(firstStickyBox?.y);
  expect((panelBox?.x ?? 0)).toBeGreaterThan((rowBox?.x ?? 0) + (rowBox?.width ?? 0));

  await page.setViewportSize({ width: 1200, height: 600 });
  await expect(page.getByTestId("songs-selection-layout-compact")).toBeVisible();
  await page.getByRole("button", { name: "Recolher menu" }).click();
  await expect(page.getByTestId("songs-selection-layout-wide")).toBeVisible();
});

test("usa card recolhível em telas pequenas sem sobrepor a lista", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  await mockSongsApi(page);
  await page.goto("/");
  await page.getByRole("tab", { name: "Músicas" }).click();
  await page.getByText("Selecionar para PDF", { exact: true }).click();

  const toggle = page.getByTestId("songs-export-card-toggle");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Nenhuma música selecionada", { exact: true })).toBeVisible();
  await page.screenshot({ path: `${screenshotDirectory}/songs-selection-mobile.png`, fullPage: true });
  await toggle.focus();
  await expect(toggle).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("Nenhuma música selecionada", { exact: true })).toHaveCount(0);
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("song-row-song-1")).toBeVisible();
});
