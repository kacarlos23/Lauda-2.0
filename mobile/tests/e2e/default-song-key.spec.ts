import { expect, test, type Page } from "@playwright/test";

const songId = "22222222-2222-4222-8222-222222222222";
const artist = { id: "11111111-1111-4111-8111-111111111111", name: "Artista de teste", imageUrl: null };

async function setup(page: Page, role = "TENANT_ADMIN", failFirstSave = false) {
  let song = {
    id: songId, title: "Canção de teste", originalKey: "G", content: "[G]Texto [D/F#]inicial",
    artist, artistId: artist.id, comments: null, bpm: 92, composer: null, createdAt: "2026-01-01", updatedAt: "2026-01-01",
  };
  const saves: unknown[] = [];
  await page.addInitScript(({ role }) => {
    localStorage.setItem("auth_token", "test.jwt.token");
    localStorage.setItem("refresh_token", "refresh.token");
    localStorage.setItem("auth_user", JSON.stringify({ id: "user-1", name: "Teste", email: "test@example.com", tenantId: "tenant-1", role }));
    localStorage.setItem("auth_tenant", JSON.stringify({ id: "tenant-1", name: "Igreja de teste" }));
  }, { role });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === `/api/songs/${songId}`) {
      if (request.method() === "PATCH") {
        const payload = request.postDataJSON();
        saves.push(payload);
        if (failFirstSave) {
          failFirstSave = false;
          await route.fulfill({ status: 500, json: { success: false, error: "Falha ao salvar. Tente novamente." } });
          return;
        }
        song = { ...song, ...payload };
      }
      await route.fulfill({ json: { success: true, data: song } });
      return;
    }
    if (path === "/api/songs" || path === "/api/artists") {
      await route.fulfill({ json: { success: true, data: { items: path === "/api/songs" ? [song] : [artist], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } } } });
      return;
    }
    if (path === "/api/songs/export") {
      await route.fulfill({ contentType: "application/pdf", body: Buffer.from("%PDF-test") });
      return;
    }
    await route.fulfill({ json: { success: true, data: [] } });
  });
  await page.goto(`/songs/${songId}`);
  await expect(page.getByTestId("current-key")).toContainText("G");
  return { saves, saved: () => song };
}

for (const width of [390, 1440]) {
  test(`salva cifra editada e reabre no tom padrão em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const api = await setup(page);
    await expect(page.getByTestId("save-default-key")).toBeDisabled();
    await page.getByLabel("Editar música", { exact: true }).click();
    await page.getByRole("tab", { name: "Texto ChordPro", exact: true }).click();
    await page.getByTestId("song-chord-input").fill("{key: G}\n[G]Texto já editado [D/F#]preservado");
    await page.getByTestId("song-save-button").last().click();
    await expect(page).toHaveURL(new RegExp(`/songs/${songId}$`));
    await page.getByTestId("transpose-up").click();
    await page.getByTestId("transpose-up").click();
    await expect(page.getByTestId("current-key")).toContainText("A");
    const before = await page.getByLabel("Cifra da música", { exact: true }).textContent() ?? "";
    await page.getByTestId("save-default-key").click();
    await expect(page.getByTestId("default-key-success")).toHaveText("Tom A salvo como padrão.");
    expect(api.saves.at(-1)).toEqual({ originalKey: "A", content: "{key: A}\n[A]Texto já editado [E/G#]preservado" });
    await expect(page.getByLabel("Cifra da música", { exact: true })).toHaveText(before);
    await expect(page.getByTestId("save-default-key")).toBeDisabled();
    const saveBox = await page.getByTestId("save-default-key").boundingBox();
    const panelBox = await page.getByTestId("song-chord-panel").boundingBox();
    expect(saveBox!.x + saveBox!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width);
    await page.screenshot({ path: `test-results/default-song-key/saved-${width}.png`, fullPage: true });

    await page.reload();
    await expect(page.getByTestId("current-key")).toContainText("A");
    await expect(page.getByText("Tom padrão: A", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Cifra da música", { exact: true })).toHaveText(before);
    await page.getByTestId("transpose-up").click();
    await expect(page.getByTestId("current-key")).toContainText("A#");
    await page.getByTestId("current-key").click();
    await expect(page.getByTestId("current-key")).toContainText("A");
    await page.getByTestId("transpose-down").click();
    await page.getByTestId("save-default-key").click();
    await expect(page.getByTestId("default-key-success")).toHaveText("Tom G# salvo como padrão.");
    expect(api.saved().content).toBe("{key: G#}\n[G#]Texto já editado [D#/G]preservado");

    const exported = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/songs/export");
    await page.getByLabel("Exportar PDF", { exact: true }).click();
    expect((await exported).postDataJSON()).toEqual({ songIds: [songId], transpositions: { [songId]: 0 } });
    await page.getByTestId("app-back-button-compact").click();
    await page.getByTestId(`song-row-${songId}`).click();
    await expect(page.getByTestId("current-key")).toContainText("G#");
    await expect(page.getByTestId("save-default-key")).toBeDisabled();
  });
}

test("falha mantém padrão e cifra intactos e permite tentar novamente", async ({ page }) => {
  const api = await setup(page, "TENANT_ADMIN", true);
  await page.getByTestId("transpose-up").click();
  await page.getByTestId("save-default-key").click();
  await expect(page.getByTestId("default-key-error")).toContainText("Falha ao salvar");
  expect(api.saved()).toMatchObject({ originalKey: "G", content: "[G]Texto [D/F#]inicial" });
  await expect(page.getByTestId("current-key")).toContainText("G#");
  await expect(page.getByText("Tom padrão: G", { exact: true })).toBeVisible();
  await page.getByTestId("save-default-key").click();
  await expect(page.getByTestId("default-key-success")).toHaveText("Tom G# salvo como padrão.");
});

test("membro pode transpor para visualizar sem gravar o padrão", async ({ page }) => {
  const api = await setup(page, "MEMBER");
  await page.getByTestId("transpose-up").click();
  await expect(page.getByTestId("current-key")).toContainText("G#");
  await expect(page.getByTestId("save-default-key")).toHaveCount(0);
  expect(api.saves).toHaveLength(0);
});

test("bloqueia novo salvamento e mudanças de tom enquanto a gravação está pendente", async ({ page }) => {
  const api = await setup(page);
  let releaseSave!: () => void;
  const pending = new Promise<void>((resolve) => { releaseSave = resolve; });
  let requests = 0;
  await page.route(`**/api/songs/${songId}`, async (route) => {
    if (route.request().method() === "PATCH") {
      requests += 1;
      await pending;
    }
    await route.fallback();
  });
  await page.getByTestId("transpose-up").click();
  await page.getByTestId("save-default-key").click();
  await expect(page.getByTestId("save-default-key")).toBeDisabled();
  await expect(page.getByTestId("transpose-up")).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("transpose-down")).toHaveAttribute("aria-disabled", "true");
  await page.getByTestId("transpose-up").dispatchEvent("click");
  await expect(page.getByTestId("current-key")).toContainText("G#");
  releaseSave();
  await expect(page.getByTestId("default-key-success")).toHaveText("Tom G# salvo como padrão.");
  expect(requests).toBe(1);
  expect(api.saves).toHaveLength(1);
});
