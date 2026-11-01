import { expect, test } from "@playwright/test";

const scheduleId = "123e4567-e89b-42d3-a456-426614174000";

for (const width of [390, 1440]) {
  test(`preserva acentos nas telas de escalas e culto em ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1200 });
    const user = { id: "encoding-user", name: "Usuário de teste", role: "TENANT_ADMIN", tenantId: "encoding-tenant" };
    const tenant = { id: user.tenantId, name: "Igreja de teste" };
    const song = { id: "encoding-song", title: "Canção de comunhão", originalKey: "G", content: "[G]Louvor", artist: { id: "encoding-artist", name: "Músico de teste" } };
    const schedule = { id: scheduleId, title: "Celebração", date: "2026-11-01T12:00:00Z", tenantId: tenant.id, ministryId: "encoding-ministry", assignments: [], songs: [{ id: "encoding-entry", songId: song.id, order: 0, moment: "Louvor", song: { ...song, artist: null } }] };
    await page.addInitScript(({ user, tenant }) => {
      localStorage.setItem("auth_token", "encoding-test");
      localStorage.setItem("refresh_token", "encoding-test");
      localStorage.setItem("auth_user", JSON.stringify(user));
      localStorage.setItem("auth_tenant", JSON.stringify(tenant));
    }, { user, tenant });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.startsWith("/api/schedules")) expect(route.request().method()).toBe("GET");
      let data: unknown = [];
      if (pathname === "/api/auth/me") data = { user, tenant };
      else if (pathname.includes("/worship-order/")) data = { date: "2026-11-01", churchName: tenant.name, morning: schedule, evening: null };
      else if (pathname === "/api/schedules") data = [schedule];
      else if (pathname === "/api/ministries") data = [{ id: schedule.ministryId, name: "Ministério de Louvor" }];
      else if (pathname === "/api/songs") data = { items: [song], pagination: { page: 1, totalPages: 1, total: 1 } };
      await route.fulfill({ json: { success: true, data } });
    });
    for (const url of ["/schedules/new?date=2026-11-01", `/schedules/${scheduleId}/edit`, "/schedules/worship-order?date=2026-11-01"]) {
      await page.goto(url, { waitUntil: "networkidle" });
      if (url.includes("worship-order")) {
        await expect(page.getByRole("heading", { name: "CULTO DA MANHÃ" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Prévia do PDF", exact: true })).toBeVisible();
        await expect(page.getByText("Período não incluído", { exact: true })).toBeVisible();
      } else {
        await expect(page.getByRole("button", { name: "Período: Culto da manhã", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Adicionar músicas à escala", exact: true })).toBeVisible();
        await expect(page.getByText("Comentários", { exact: true })).toBeVisible();
      }
      const rendered = await page.locator("body").innerText();
      expect(rendered).not.toMatch(/\uFFFD|\u00c3[\u0080-\u00bf]|\u00c2[\u0080-\u00bf]/);
      const labels = await page.locator("[aria-label]").evaluateAll((elements) => elements.map((element) => element.getAttribute("aria-label")).join("\n"));
      expect(labels).not.toMatch(/\uFFFD|\u00c3[\u0080-\u00bf]/);
      if (url.includes("worship-order")) await expect(page.getByText("Artista não informado", { exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${url.includes("worship-order") ? "culto" : url.includes("/new") ? "nova" : "editar"}-${width}.png`), fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}
