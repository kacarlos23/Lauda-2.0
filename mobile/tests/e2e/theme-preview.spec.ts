import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

// Run against the isolated preview using LAUDA_THEME_PREVIEW_TEST=1 and
// PLAYWRIGHT_BASE_URL=http://127.0.0.1:8094, after prepare-theme-preview.cjs.
test.skip(process.env.LAUDA_THEME_PREVIEW_TEST !== "1", "Requires the isolated local theme preview");
const output = path.resolve("../test-results/theme-preview/screenshots");
const fixturePath = path.resolve("../test-results/theme-preview/fixture.json");
if (process.env.LAUDA_THEME_PREVIEW_TEST === "1") {
  test.use({ storageState: path.resolve("../test-results/theme-preview/session.local.json") });
}

async function login(page: Page) {
  await page.goto("/?theme=dark");
  await expect(page.getByTestId("theme-toggle")).toBeVisible();
  await page.waitForLoadState("networkidle");
}
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mkdir(output, { recursive: true });
});

test("switches the existing music list without changing its geometry and persists the preference", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Músicas", exact: true }).click();
  const row = page.getByRole("button", { name: "Abrir cifra Ajuntamento", exact: true });
  await expect(row).toBeVisible();
  const darkBounds = await row.boundingBox();
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
  await page.screenshot({ path: path.join(output, "musicas-escuro.png") });
  await page.getByRole("button", { name: "Ativar modo claro", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "light");
  expect(await row.boundingBox()).toEqual(darkBounds);
  await page.screenshot({ path: path.join(output, "musicas-claro.png") });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "light");
  await expect(row).toBeVisible();
  await page.getByRole("button", { name: "Ativar modo escuro", exact: true }).click();
  await page.getByRole("button", { name: "Importar ou exportar músicas", exact: true }).click();
  await expect(page.getByText("Importar e exportar músicas", { exact: true })).toBeVisible();
  const dialogSurface = await page.getByText("Importar e exportar músicas", { exact: true }).evaluate((element) => {
    let current: Element | null = element;
    while (current) {
      const background = getComputedStyle(current).backgroundColor;
      if (background !== "rgba(0, 0, 0, 0)") return background;
      current = current.parentElement;
    }
    return "transparent";
  });
  expect(dialogSurface).toBe("rgb(25, 33, 28)");
  await page.screenshot({ path: path.join(output, "importacao-escuro.png") });
});

test("keeps the calendar, schedule editor, song moments and chord controls functional", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Escalas", exact: true }).click();
  await page.getByRole("button", { name: "Selecionar domingo, 25 de outubro", exact: true }).click();
  const schedule = page.getByRole("button", { name: "Editar escala Culto da manhã", exact: true });
  await expect(schedule).toBeVisible();
  await page.screenshot({ path: path.join(output, "escalas-escuro.png") });
  await schedule.getByText("Culto da manhã", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Momento de Ajuntamento: Louvor", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Momento de Ajuntamento: Louvor", exact: true }).click();
  await expect(page.getByRole("button", { name: "Momento: Ofertório", exact: true }).first()).toBeVisible();
  await page.screenshot({ path: path.join(output, "editar-escala-escuro.png") });
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  await page.goto(`/songs/${fixture.songs[0].id}`);
  await expect(page.getByTestId("current-key")).toContainText("G");
  await page.getByTestId("transpose-up").click();
  await expect(page.getByTestId("current-key")).toContainText("G#");
  await page.screenshot({ path: path.join(output, "cifra-escuro.png") });
});

test("uses the actual screens across modules and adapts to the mobile viewport", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  const screens = [
    ["inicio", "/"], ["ministerios", "/ministries"], ["ministerio", `/ministries/${fixture.ministryId}`],
    ["equipe", `/ministries/${fixture.ministryId}/members`], ["vincular", `/ministries/assign?ministryId=${fixture.ministryId}`],
    ["membros", "/members"], ["novo-membro", "/members/new"], ["igreja", "/church"],
    ["artistas", "/artists"], ["instrumentos", "/instruments"], ["nova-musica", "/songs/new"],
    ["editar-musica", `/songs/${fixture.songs[0].id}/edit`], ["nova-escala", "/schedules/new"],
    ["ordem-culto", "/schedules/worship-order?date=2026-10-25"], ["perfil", "/profile"], ["mais", "/more"],
  ];
  for (const [name, url] of screens) {
    await page.goto(url);
    await expect(page.getByTestId("theme-toggle")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
    await page.screenshot({ path: path.join(output, `${name}-escuro.png`) });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [name, url] of [["musicas", "/songs"], ["cifra", `/songs/${fixture.songs[0].id}`], ["perfil", "/profile"]]) {
    await page.goto(url);
    await expect(page.getByTestId("theme-toggle")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    if (name === "musicas") {
      for (const label of ["Importar ou exportar músicas", "Gerenciar artistas", "Nova música"]) {
        const bounds = await page.getByRole("button", { name: label, exact: true }).boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
      }
    }
    await page.screenshot({ path: path.join(output, `${name}-mobile-escuro.png`) });
  }
});

test("supports Claro, Escuro and Sistema in the profile with a live system preference", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await login(page);
  await page.getByRole("link", { name: "Perfil", exact: true }).click();
  await page.getByRole("radio", { name: "Tema sistema", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "light");
  await page.getByRole("radio", { name: "Tema escuro", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Tema escuro", exact: true })).toBeChecked();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
});

test.describe("public access", () => {
test.use({ storageState: { cookies: [], origins: [] } });
test("renders the public access screens in the same dark theme", async ({ page }) => {
  test.setTimeout(60_000);
  for (const [name, url] of [
    ["login", "/login?theme=dark"], ["criar-igreja", "/register"], ["cadastro-convite", "/member-register"],
    ["recuperar-senha", "/forgot-password"], ["redefinir-senha", "/reset-password?email=visual%40lauda.test"],
    ["convite-invalido", "/convite?code=VISUAL"],
  ]) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
    await page.screenshot({ path: path.join(output, `${name}-escuro.png`) });
  }
});
});
