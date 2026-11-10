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
  const tags = new Map([
    ["song-1", ["Adoração", "Louvor/Celebração", "Natal", "Gratidão"]],
    ["song-2", ["Comunhão/Santa Ceia"]],
    ["song-4", ["Adoração"]],
  ]);
  const names = [...new Set([...tags.values()].flat())];
  const themes = new Map(names.map((name, index) => [name, `theme-${index}`]));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/songs" || url.pathname === "/api/songs/tags") {
      const query = (url.searchParams.get("search") ?? "").trim().toLocaleLowerCase("pt-BR");
      const themeOnly = query.startsWith("#");
      const term = themeOnly ? query.slice(1) : query;
      const artistId = url.searchParams.get("artistId");
      const originalKey = url.searchParams.get("originalKey");
      const scope = songs.map((song) => ({ ...song, tags: tags.get(song.id) ?? [] })).filter((song) =>
        (!artistId || song.artistId === artistId) && (!originalKey || song.originalKey === originalKey)
        && (!term || song.tags.some((name) => name.toLocaleLowerCase("pt-BR").includes(term))
          || (!themeOnly && `${song.title} ${song.artist.name}`.toLocaleLowerCase("pt-BR").includes(term)))
      );
      if (url.pathname.endsWith("/tags")) {
        const items = [...themes].map(([name, id]) => ({ id, name, count: scope.filter((song) => song.tags.includes(name)).length }));
        await route.fulfill({ json: { success: true, data: { items, untaggedCount: scope.filter((song) => !song.tags.length).length } } });
        return;
      }
      const selected = url.searchParams.get("tags")?.split(",") ?? [];
      const untagged = url.searchParams.get("untagged") === "true";
      const items = scope.filter((song) => (!selected.length && !untagged)
        || song.tags.some((name) => selected.includes(name)) || (untagged && !song.tags.length));
      await route.fulfill({ json: {
        success: true,
        data: { items, pagination: { page: 1, limit: 20, total: items.length, totalPages: Number(Boolean(items.length)) } },
      } });
      return;
    }

    if (url.pathname === "/api/songs/tags/batch" && request.method() === "PATCH") {
      const { songIds, tagIds, operation } = request.postDataJSON() as { songIds: string[]; tagIds: string[]; operation: "add" | "remove" };
      const picked = [...themes].filter(([, id]) => tagIds.includes(id)).map(([name]) => name);
      const items = songIds.map((id) => {
        const current = tags.get(id) ?? [];
        const next = operation === "add" ? [...new Set([...current, ...picked])] : current.filter((name) => !picked.includes(name));
        tags.set(id, next);
        return { id, tags: next };
      });
      await route.fulfill({ json: { success: true, data: { items, updated: items.length } } });
      return;
    }

    const individual = /^\/api\/songs\/([^/]+)\/tags$/.exec(url.pathname);
    if (individual && request.method() === "PATCH") {
      const { operation, name } = request.postDataJSON() as { operation: "add" | "remove"; name: string };
      const id = individual[1];
      const current = tags.get(id) ?? [];
      const next = operation === "add" ? [...new Set([...current, name])] : current.filter((tag) => tag !== name);
      if (!themes.has(name)) themes.set(name, `theme-${themes.size}`);
      tags.set(id, next);
      await route.fulfill({ json: { success: true, data: { id, tags: next } } });
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

test("mostra temas e aplica ações em lote com a barra fixa no desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 760 });
  await authenticate(page);
  await mockSongsApi(page);
  await page.goto("/songs");

  const search = page.getByRole("textbox", { name: "Buscar músicas" });
  await expect(search).toHaveAttribute("placeholder", "Música, artista ou #tema");
  await expect(page.getByTestId("song-row-song-1").getByText("+1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Adoração, 2 músicas" }).click();
  await expect(page.getByText("2 músicas encontradas", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sem tema, 4 músicas" }).click();
  await expect(page.getByText("6 músicas encontradas", { exact: true })).toBeVisible();
  await search.fill("#natal");
  await expect(page.getByText("1 música encontrada", { exact: true })).toBeVisible();
  await search.fill("");
  await page.getByRole("button", { name: "Selecionar músicas", exact: true }).click();
  await page.getByRole("checkbox", { name: "Selecionar Aclame ao Senhor" }).click();
  await page.getByRole("checkbox", { name: "Selecionar Autor da minha fé" }).click();

  const bar = page.getByTestId("song-selection-bar");
  await expect(bar).toContainText("2 selecionadas");
  await page.screenshot({ path: `${screenshotDirectory}/songs-themes-selection.png` });
  const initialY = (await bar.boundingBox())!.y;
  await page.getByTestId("song-catalog-scroll").evaluate((node) => { node.scrollTop = 300; });
  expect((await bar.boundingBox())!.y).toBe(initialY);

  await bar.getByRole("button", { name: "Adicionar tema" }).click();
  await page.getByRole("checkbox", { name: "Gratidão", exact: true }).click();
  const batch = page.waitForRequest((request) => request.method() === "PATCH" && new URL(request.url()).pathname === "/api/songs/tags/batch");
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  expect((await batch).postDataJSON()).toMatchObject({ songIds: ["song-1", "song-3"], operation: "add", tagIds: ["theme-3"] });
  await expect(page.getByText("Temas atualizados em 2 músicas.")).toBeVisible();
  await expect(bar).toContainText("2 selecionadas");
  await bar.getByRole("button", { name: "Cancelar seleção" }).click();
  await expect(bar).toHaveCount(0);
});

test("edita temas em um popover e reverte uma gravação rejeitada", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await authenticate(page);
  await mockSongsApi(page);
  await page.goto("/songs");
  const row = page.getByTestId("song-row-song-1");
  await row.getByRole("button", { name: "Editar temas de Aclame ao Senhor" }).click();
  const menu = page.getByTestId("song-theme-popover");
  await expect(menu.getByText("salva na hora")).toBeVisible();
  await expect(menu.getByRole("checkbox", { name: "Adoração", exact: true })).toBeChecked();
  await page.screenshot({ path: `${screenshotDirectory}/songs-themes-desktop.png` });
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => { finish = resolve; });
  await page.route("**/api/songs/song-1/tags", async (route) => {
    await gate;
    await route.fulfill({ status: 409, json: { success: false, error: "Tema não salvo." } });
  });
  const option = menu.getByRole("checkbox", { name: "Missões", exact: true });
  try {
    await option.click();
    await expect(option).toBeChecked();
  } finally {
    finish();
  }
  await expect(option).not.toBeChecked();
  await expect(menu.getByRole("alert")).toHaveText("Tema não salvo.");
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
});

test("rola os chips no mobile e mantém o menu e a seleção dentro da tela", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  await mockSongsApi(page);
  await page.goto("/songs");

  const track = page.getByTestId("song-theme-scroll");
  await expect(track).toBeVisible();
  expect(await track.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.getByRole("button", { name: "Editar temas de Aclame ao Senhor" }).click();
  await expect(page.getByRole("checkbox", { name: "Natal", exact: true })).toBeChecked();
  await expect(page.getByRole("textbox", { name: "Criar tema" })).toBeInViewport();
  await page.screenshot({ path: `${screenshotDirectory}/songs-themes-mobile.png` });
  await page.getByRole("button", { name: "Fechar", exact: true }).click();

  await page.getByRole("button", { name: "Selecionar músicas", exact: true }).click();
  await page.getByRole("checkbox", { name: "Selecionar Aclame ao Senhor" }).click();
  await page.setViewportSize({ width: 320, height: 680 });
  const bar = page.getByTestId("song-selection-bar");
  await expect(bar.getByRole("button", { name: "Cancelar seleção" })).toBeInViewport();
  await expect(bar.getByRole("button", { name: "Exportar PDF" })).toBeInViewport();
  const box = (await bar.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(320);
});
