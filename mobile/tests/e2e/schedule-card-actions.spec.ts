import { expect, test } from "@playwright/test";

for (const width of [2504, 1370, 390]) {
  test(`card de escala, ações independentes e layout em ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const permissions = ["schedule:view", "schedule:create", "schedule:edit", "schedule:view_reports", "song:view", "song:attach_to_schedule"];
    const user = { id: "user", name: "Admin", role: "TENANT_ADMIN", tenantId: "tenant", permissions };
    const tenant = { id: "tenant", name: "Igreja de teste" };
    await page.addInitScript(({ user, tenant }) => {
      localStorage.setItem("auth_token", "test-token"); localStorage.setItem("refresh_token", "test-refresh");
      localStorage.setItem("auth_user", JSON.stringify(user)); localStorage.setItem("auth_tenant", JSON.stringify(tenant));
    }, { user, tenant });
    const id = "123e4567-e89b-42d3-a456-426614174000";
    const song = { id: "123e4567-e89b-42d3-a456-426614174001", title: "Música cadastrada", originalKey: "C", content: "[C]Música de teste", artist: { name: "Artista" } };
    const schedule = { id, title: "Culto de teste", date: "2026-10-21T12:00:00Z", ministryId: "ministry", ministry: { id: "ministry", name: "Louvor" }, tenantId: tenant.id, assignments: [], songs: [{ id: "entry", songId: song.id, order: 0, song }] };
    const errors: string[] = []; let duplicates = 0;
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/report") || path === "/api/songs/export") {
        await route.fulfill({ contentType: "application/pdf", body: "%PDF-1.4\n%%EOF" }); return;
      }
      let data: unknown = [];
      if (path === "/api/auth/me") data = { user, tenant, permissions };
      if (path === "/api/schedules") {
        data = [schedule];
        if (route.request().method() === "POST") { duplicates++; data = { ...schedule, id: "123e4567-e89b-42d3-a456-426614174002", title: "Copia de Culto de teste" }; }
      }
      if (path === "/api/ministries") data = [schedule.ministry];
      if (path === "/api/songs") data = { items: [song], pagination: { page: 1, totalPages: 1 } };
      if (path === `/api/songs/${song.id}`) data = song;
      if (path.endsWith("/worship-order/2026-10-21")) data = null;
      await route.fulfill({ json: { success: true, data } });
    });
    const open = () => page.goto("/schedules?date=2026-10-21", { waitUntil: "networkidle" });
    await open();
    const worship = page.getByRole("button", { name: "Gerar Ordem de Culto", exact: true });
    const create = page.getByRole("button", { name: "Criar nova escala", exact: true });
    if (width >= 1370) {
      const a = (await worship.boundingBox())!, b = (await create.boundingBox())!;
      expect(a.x + a.width).toBeLessThanOrEqual(b.x); expect(Math.abs(a.y - b.y)).toBeLessThan(2);
    }
    expect(await page.getByRole("button", { name: /Selecionar quarta-feira, 21 de outubro/i }).evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(52);
    const card = page.getByTestId(`schedule-card-${id}`);
    await expect(card.getByText("Editar", { exact: true })).toHaveCount(0);
    const duplicate = card.getByRole("button", { name: "Duplicar escala Culto de teste", exact: true });
    expect(await duplicate.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(225, 236, 230)");
    expect((await duplicate.boundingBox())!.height).toBe(36);
    const songCard = card.getByTestId("schedule-song-compact");
    const filter = () => card.evaluate((el) => getComputedStyle(el).filter);
    await card.getByText("Culto de teste", { exact: true }).hover();
    await expect.poll(filter).toBe("brightness(0.94)");
    for (const label of ["Duplicar escala Culto de teste", "Abrir Ordem de Culto da escala Culto de teste", "Gerar relatório da escala Culto de teste", "Exportar cifras da escala Culto de teste"]) {
      await card.getByRole("button", { name: label, exact: true }).hover();
      await expect.poll(filter).toBe("none");
    }
    await card.getByRole("link", { name: "Abrir cifra de Música cadastrada", exact: true }).hover();
    await expect.poll(filter).toBe("none");
    await expect.poll(() => songCard.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe("none");
    await expect.poll(() => songCard.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42)).toBe(-2);
    await page.mouse.move(0, 0);
    await expect.poll(() => songCard.evaluate((el) => getComputedStyle(el).boxShadow)).toBe("none");
    const musicBounds = (await songCard.boundingBox())!;
    const actionsBounds = (await duplicate.locator("..").boundingBox())!;
    expect(Math.abs(musicBounds.width - actionsBounds.width)).toBeLessThan(2);
    expect(Math.abs(musicBounds.x - actionsBounds.x)).toBeLessThan(2);
    await duplicate.click(); expect(duplicates).toBe(1); await expect(page).toHaveURL(/\/schedules\?date=/);
    for (const label of ["Gerar relatório da escala Culto de teste", "Exportar cifras da escala Culto de teste"]) {
      const download = page.waitForEvent("download"); await card.getByRole("button", { name: label, exact: true }).click(); await download;
      await expect(page).toHaveURL(/\/schedules\?date=/);
    }
    await card.getByRole("button", { name: "Abrir Ordem de Culto da escala Culto de teste", exact: true }).click();
    await expect(page).toHaveURL(/\/schedules\/worship-order\?date=2026-10-21/);
    await open();
    await card.getByText("Culto de teste", { exact: true }).click(); await expect(page).toHaveURL(new RegExp(`/schedules/${id}/edit`));
    await open();
    await card.focus(); await page.keyboard.press("Enter"); await expect(page).toHaveURL(new RegExp(`/schedules/${id}/edit`));
    await open();
    await card.getByRole("link", { name: "Abrir cifra de Música cadastrada", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/songs/${song.id}`));
    await open();
    await page.mouse.move(0, 0);
    await page.screenshot({ path: testInfo.outputPath(`schedules-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(errors).toEqual([]);
  });
}
