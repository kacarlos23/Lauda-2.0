import { expect, test, Page } from "@playwright/test";

test.use({ channel: "chromium" });
const user = { id: "draft-user", name: "Admin", tenantId: "draft-tenant", role: "TENANT_ADMIN" };
const tenant = { id: user.tenantId, name: "Igreja de teste" };
const song = { id: "22222222-2222-4222-8222-222222222222", tenantId: tenant.id, title: "Música original", artistId: "artist-1", artist: { id: "artist-1", name: "Artista" }, originalKey: "C", content: "C G Am F", comments: "", createdAt: "", updatedAt: "" };
const schedule = { id: "schedule-1", tenantId: tenant.id, title: "Culto", date: "2026-10-20T22:00:00Z", ministryId: "ministry", songs: [], assignments: [] };

async function setup(page: Page) {
  await page.addInitScript(({ user, tenant }) => {
    localStorage.setItem("auth_token", "test"); localStorage.setItem("refresh_token", "test");
    localStorage.setItem("auth_user", JSON.stringify(user)); localStorage.setItem("auth_tenant", JSON.stringify(tenant));
  }, { user, tenant });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: any = [];
    if (path === "/api/auth/me") data = { user, tenant };
    else if (path.includes("/worship-order/")) data = route.request().method() === "PUT" ? { morning: schedule, evening: null } : null;
    else if (path === "/api/ministries") data = [{ id: "ministry", name: "Louvor" }];
    else if (path === "/api/schedules") data = route.request().method() === "POST" ? { ...schedule, ...route.request().postDataJSON() } : [schedule];
    else if (path === "/api/songs/22222222-2222-4222-8222-222222222222") data = route.request().method() === "PATCH" ? { ...song, ...route.request().postDataJSON() } : song;
    else if (path === "/api/songs") data = { items: [song], pagination: { page: 1, totalPages: 1 } };
    await route.fulfill({ json: { success: true, data } });
  });
}

for (const width of [390, 1440]) {
  test(`escala usa o dia escolhido, descarta e recupera somente rascunho explícito em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1200 }); await setup(page);
    await page.goto("/schedules");
    await page.goto("/schedules/new?date=2026-10-20");
    await expect(page.getByTestId("schedule-date")).toHaveValue("20/10/2026");
    const title = page.getByTestId("schedule-title");
    await title.fill("Descartar esta escala");
    await page.getByRole("button", { name: "Voltar", exact: true }).click();
    await expect(page.getByText("Alterações não salvas", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Continuar editando" }).click();
    await expect(title).toHaveValue("Descartar esta escala");
    expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("lauda-form-v1:")))).toEqual([]);
    if (width < 600) await page.getByRole("tab", { name: /Músicas/ }).click();
    else await page.getByRole("link", { name: "Músicas", exact: true }).click();
    await expect(page.getByText("Alterações não salvas", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Continuar editando" }).click();
    await expect(title).toHaveValue("Descartar esta escala");
    await page.getByRole("button", { name: "Voltar", exact: true }).click();
    await page.getByRole("button", { name: "Sair sem salvar", exact: true }).click();
    await expect(page).toHaveURL(/\/schedules$/);
    await page.getByRole("button", { name: /Nova escala/i }).first().click();
    await expect(title).toHaveValue("");
    await page.getByTestId("schedule-date").fill("21/10/2026");
    await title.fill("Rascunho mantido");
    await page.getByRole("button", { name: "Voltar", exact: true }).click();
    await page.getByRole("button", { name: "Manter rascunho e sair" }).click();
    await expect(page).toHaveURL(/\/schedules$/);
    await page.getByRole("button", { name: /Nova escala/i }).first().click();
    await expect(page.getByText("Rascunho disponível", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Recuperar rascunho", exact: true }).click();
    await expect(title).toHaveValue("Rascunho mantido");
    await expect(page.getByTestId("schedule-date")).toHaveValue("21/10/2026");
    await page.getByRole("button", { name: "Voltar", exact: true }).click();
    await page.getByRole("button", { name: "Salvar e sair", exact: true }).click();
    await expect(page).toHaveURL(/\/schedules$/);
    expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("lauda-form-v1:")))).toEqual([]);
    await page.getByRole("button", { name: /Selecionar .*22 de outubro/ }).click();
    await page.getByRole("button", { name: "Criar escala", exact: true }).click();
    await expect(page.getByTestId("schedule-date")).toHaveValue("22/10/2026");
    await expect(title).toHaveValue("");
    await page.getByRole("button", { name: "Voltar", exact: true }).click();
    await expect(page).toHaveURL(/\/schedules$/);
    await expect(page.getByText("Alterações não salvas", { exact: true })).not.toBeVisible();
  });

  test(`voltar do navegador protege edição de música em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1200 }); await setup(page);
    await page.goto("/songs/22222222-2222-4222-8222-222222222222");
    await page.getByLabel("Editar música", { exact: true }).click();
    await page.getByText("Editar dados", { exact: true }).click();
    await expect(page.locator('input[value="Música original"]')).toBeVisible();
    await page.locator('input[value="Música original"]').fill("Música alterada");
    await page.getByRole("button", { name: "Voltar", exact: true }).click();
    await expect(page.getByText("Alterações não salvas", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Continuar editando" }).click();
    await page.goBack();
    await expect(page.getByText("Alterações não salvas", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Manter rascunho e sair" }).click();
    await expect(page).toHaveURL(/\/songs\/22222222-2222-4222-8222-222222222222$/);
    await page.goto("/songs/22222222-2222-4222-8222-222222222222/edit");
    await page.getByRole("button", { name: "Recuperar rascunho", exact: true }).click();
    await expect(page.locator('input[value="Música alterada"]')).toBeVisible();
    await page.route("**/api/songs/22222222-2222-4222-8222-222222222222", (route) => route.fulfill({ status: 500, json: { success: false, error: "Falha de teste" } }));
    await page.getByRole("button", { name: "Voltar", exact: true }).click();
    await page.getByRole("button", { name: "Salvar e sair", exact: true }).click();
    await expect(page.getByRole("button", { name: "Continuar editando", exact: true })).toBeEnabled();
    await expect(page).toHaveURL(/\/edit$/);
    await page.getByRole("button", { name: "Continuar editando", exact: true }).click();
    await expect(page.locator('input[value="Música alterada"]')).toBeVisible();
    await page.unroute("**/api/songs/22222222-2222-4222-8222-222222222222");
    await page.getByRole("button", { name: "Voltar", exact: true }).click();
    await page.getByRole("button", { name: "Salvar e sair", exact: true }).click();
    await expect(page).toHaveURL(/\/songs\/22222222-2222-4222-8222-222222222222$/);
    expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("lauda-form-v1:")))).toEqual([]);
  });

  test(`ordem de culto protege saída pelo menu e salva rascunho em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1200 }); await setup(page);
    await page.goto("/schedules/worship-order?date=2026-10-20");
    await page.getByRole("button", { name: "Selecionar escala", exact: true }).first().click();
    await page.getByRole("button", { name: /Culto ·/ }).click();
    await page.getByRole("button", { name: "Voltar às escalas", exact: true }).click();
    await expect(page.getByText("Alterações não salvas", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Manter rascunho e sair" }).click();
    await expect(page).toHaveURL(/\/schedules$/);
    await page.goto("/schedules/worship-order?date=2026-10-20");
    await page.getByRole("button", { name: "Recuperar rascunho", exact: true }).click();
    await expect(page.getByText("Culto · 0 músicas", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Voltar às escalas", exact: true }).click();
    await page.getByRole("button", { name: "Salvar e sair", exact: true }).click();
    await expect(page).toHaveURL(/\/schedules$/);
  });
}
