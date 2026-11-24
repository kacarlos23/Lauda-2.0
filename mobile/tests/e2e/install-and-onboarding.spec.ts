import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";

const tenant = { id: "tenant-1", name: "Igreja Central" };
const token = "test.jwt.token";

const defaultInstruments = [
  { id: "instrument-1", name: "Teclado", colorHex: "#2563EB" },
  { id: "instrument-2", name: "Vocalista", colorHex: "#10B981" },
];

const memberPermissions = ["song:view", "schedule:view", "schedule:respond", "ministry:view"];
const adminPermissions = [
  ...memberPermissions,
  "instrument:create",
  "instrument:edit",
  "instrument:delete",
  "member:view",
  "tenant:manage",
];

function collectErrors(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message: ConsoleMessage) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  return { pageErrors, consoleErrors };
}

async function setupApiMocks(
  page: Page,
  options: {
    role?: "MEMBER" | "TENANT_ADMIN";
    instruments?: typeof defaultInstruments;
    catalog?: typeof defaultInstruments;
    onboarding?: {
      version: string;
      status: "not_started" | "dismissed" | "completed";
      shouldAutoStart: boolean;
      completedAt?: string | null;
      dismissedAt?: string | null;
      updatedAt?: string | null;
    };
    apkRelease?: Record<string, unknown>;
    onOnboardingPatch?: (payload: { version?: string; status: string }) => void;
    onInstrumentsPatch?: (payload: { instrumentIds: string[] }) => void;
  } = {}
) {
  const role = options.role ?? "MEMBER";
  const permissions = role === "TENANT_ADMIN" ? adminPermissions : memberPermissions;
  const catalog = [...(options.catalog ?? defaultInstruments)];
  let userInstruments = [...(options.instruments ?? [])];
  let onboardingState = options.onboarding
    ? { ...options.onboarding }
    : {
        version: "v1",
        status: "not_started" as const,
        shouldAutoStart: true,
        completedAt: null,
        dismissedAt: null,
        updatedAt: null,
      };

  const currentUser = () => ({
    id: role === "TENANT_ADMIN" ? "admin-1" : "member-1",
    name: role === "TENANT_ADMIN" ? "Ana Admin" : "Bruno Membro",
    email: role === "TENANT_ADMIN" ? "ana@example.com" : "bruno@example.com",
    role,
    tenantId: tenant.id,
    permissions,
    instruments: userInstruments,
    onboarding: onboardingState,
  });

  if (options.apkRelease) {
    await page.route("**/apk-release.json", async (route) => {
      await route.fulfill({ json: options.apkRelease });
    });
  }

  await page.route("https://downloads.laudaapp.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Disposition": 'attachment; filename="lauda-v1.4.0-b4.apk"',
      },
      body: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    });
  });

  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const pathname = new URL(req.url()).pathname;

    if (pathname === "/api/auth/login" && req.method() === "POST") {
      await route.fulfill({
        json: {
          success: true,
          data: { token, refreshToken: "refresh-token", user: currentUser(), tenant },
        },
      });
      return;
    }

    if (pathname === "/api/auth/me") {
      await route.fulfill({
        json: { success: true, data: { user: currentUser(), tenant, permissions } },
      });
      return;
    }

    if (pathname === "/api/members/me") {
      await route.fulfill({ json: { success: true, data: currentUser() } });
      return;
    }

    if (pathname === "/api/members/me/onboarding") {
      if (req.method() === "PATCH") {
        const body = req.postDataJSON() as { version?: string; status: "not_started" | "dismissed" | "completed" };
        options.onOnboardingPatch?.(body);
        if (onboardingState.status !== "completed") {
          onboardingState = {
            version: body.version ?? "v1",
            status: body.status,
            shouldAutoStart: body.status === "not_started",
            completedAt: body.status === "completed" ? new Date().toISOString() : null,
            dismissedAt: body.status === "dismissed" ? new Date().toISOString() : onboardingState.dismissedAt ?? null,
            updatedAt: new Date().toISOString(),
          };
        }
      }
      await route.fulfill({ json: { success: true, data: onboardingState } });
      return;
    }

    if (pathname === "/api/instruments") {
      if (req.method() === "POST") {
        const body = req.postDataJSON() as { name: string; colorHex?: string | null };
        const created = {
          id: `instrument-${catalog.length + 1}`,
          name: body.name,
          colorHex: body.colorHex ?? "#2563EB",
        };
        catalog.push(created);
        await route.fulfill({ status: 201, json: { success: true, data: created } });
        return;
      }
      await route.fulfill({ json: { success: true, data: catalog } });
      return;
    }

    if (pathname === "/api/members/me/instruments" && req.method() === "PATCH") {
      const body = req.postDataJSON() as { instrumentIds: string[] };
      options.onInstrumentsPatch?.(body);
      userInstruments = catalog.filter((item) => body.instrumentIds.includes(item.id));
      await route.fulfill({
        json: {
          success: true,
          data: { id: currentUser().id, instruments: userInstruments },
        },
      });
      return;
    }

    if (pathname === "/api/notifications") {
      await route.fulfill({ json: { success: true, data: { items: [], unreadCount: 0, nextCursor: null } } });
      return;
    }

    await route.fulfill({ json: { success: true, data: [] } });
  });
}

async function login(page: Page, email = "bruno@example.com") {
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill("secret123");
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("header-profile-button").last()).toBeVisible();
}

test("manifesto PWA, service worker e apk-release padrão servem corretamente sem erros", async ({ page, request }) => {
  const manifestRes = await request.get("/site.webmanifest");
  expect(manifestRes.status()).toBe(200);
  const manifest = await manifestRes.json();
  expect(manifest).toMatchObject({
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
  });
  const purposes = (manifest.icons as Array<{ purpose?: string }>).map((icon) => icon.purpose);
  expect(purposes).toContain("any");
  expect(purposes).toContain("maskable");

  const swManifestRes = await request.get("/sw-manifest.json");
  expect(swManifestRes.status()).toBe(200);
  expect(swManifestRes.headers()["cache-control"]).toContain("no-cache");
  const swManifest = await swManifestRes.json();
  expect(swManifest.files).toContain("/index.html");
  expect(swManifest.files).not.toContain("/(tabs)/index.html");
  expect(swManifest.files).not.toContain("/(auth)/login.html");
  expect(swManifest.files).not.toContain("/_sitemap.html");
  expect(swManifest.files).not.toContain("/+not-found.html");

  const swRes = await request.get("/sw.js");
  expect(swRes.status()).toBe(200);
  expect(swRes.headers()["cache-control"]).toContain("no-cache");
  const swText = await swRes.text();
  expect(swText).toContain("/_expo/static/js/web/");
  expect(swText).toContain('url.pathname.startsWith("/api/")');

  const apkRes = await request.get("/apk-release.json");
  expect(apkRes.status()).toBe(200);
  expect(await apkRes.json()).toEqual({ available: false });

  const errors = collectErrors(page);
  await setupApiMocks(page);
  await page.goto("/", { waitUntil: "networkidle" });
  const swStatus = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    const keys = await caches.keys();
    return {
      active: Boolean(reg.active),
      hasShellCache: keys.some((key) => key.startsWith("lauda-shell-")),
    };
  });
  expect(swStatus).toEqual({ active: true, hasShellCache: true });
  expect(errors.pageErrors).toEqual([]);
  expect(errors.consoleErrors).toEqual([]);
});

test("exibe download do APK por plataforma (Login, Mais e Perfil/Sidebar), oculta no Início e guia instalação", async ({ page, browser }) => {
  const validApkRelease = {
    available: true,
    environment: "production",
    version: "1.4.0",
    versionCode: 4,
    fileSizeBytes: 52_428_800,
    releaseNotes: "Versão inicial para Android.",
    url: "https://downloads.laudaapp.com/production/lauda-v1.4.0-b4.apk",
    sha256: "c".repeat(64),
  };

  // 1. Sem APK anunciado, não exibe botões de APK ou PWA competindo no Desktop
  const desktopErrors = collectErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await setupApiMocks(page, {
    onboarding: { version: "v1", status: "completed", shouldAutoStart: false },
  });
  await page.goto("/login", { waitUntil: "networkidle" });
  await expect(page.getByTestId("login-install-apk-download-button")).toHaveCount(0);
  await expect(page.getByTestId("login-install-install-button")).toHaveCount(0);

  await login(page);
  await expect(page.getByTestId("sidebar-apk-download")).toHaveCount(0);
  await expect(page.getByTestId("home-install-apk-download-button")).toHaveCount(0);

  // 2. Desktop com APK anunciado: Login, Sidebar e Perfil (ausente no Início)
  await page.evaluate(() => window.localStorage.clear());
  await page.unroute("**/apk-release.json").catch(() => undefined);
  await page.unroute("**/api/**").catch(() => undefined);
  await setupApiMocks(page, {
    onboarding: { version: "v1", status: "completed", shouldAutoStart: false },
    apkRelease: validApkRelease,
  });

  await page.goto("/login", { waitUntil: "networkidle" });
  await expect(page.getByTestId("login-install-apk-download-button")).toBeVisible();
  await page.getByTestId("login-install-apk-guide-button").click();
  await expect(page.getByTestId("login-install-apk-guide-modal")).toBeVisible();
  await expect(page.getByTestId("login-install-apk-desktop-note")).toBeVisible();
  await page.getByTestId("login-install-apk-checksum-toggle").click();
  await expect(page.getByTestId("login-install-apk-checksum-details")).toBeVisible();
  await page.getByTestId("login-install-apk-guide-close").click();
  await expect(page.getByTestId("login-install-apk-guide-modal")).toHaveCount(0);

  await login(page);
  await expect(page.getByTestId("home-install-panel")).toHaveCount(0);
  await expect(page.getByTestId("home-install-apk-download-button")).toHaveCount(0);
  await expect(page.getByTestId("sidebar-apk-download")).toBeVisible();

  await page.getByTestId("sidebar-apk-download").click();
  await expect(page).toHaveURL(/\/profile\?section=app/);
  await expect(page.getByTestId("profile-install-panel")).toBeVisible();
  await expect(page.getByTestId("profile-install-apk-download-button")).toBeVisible();
  expect(desktopErrors.pageErrors).toEqual([]);
  expect(desktopErrors.consoleErrors).toEqual([]);

  // 3. Mobile Android (navegador e PWA standalone): Login e Mais exibem APK; Início não
  const androidContext = await browser.newContext({
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
    viewport: { width: 390, height: 844 },
  });
  try {
    const androidPage = await androidContext.newPage();
    const androidErrors = collectErrors(androidPage);
    await setupApiMocks(androidPage, {
      onboarding: { version: "v1", status: "completed", shouldAutoStart: false },
      apkRelease: validApkRelease,
    });

    await androidPage.goto("/login", { waitUntil: "networkidle" });
    await expect(androidPage.getByTestId("login-install-apk-download-button")).toBeVisible();
    await login(androidPage);
    await expect(androidPage.getByTestId("home-install-apk-download-button")).toHaveCount(0);

    await androidPage.getByRole("tab", { name: "Mais" }).first().click();
    await expect(androidPage.getByTestId("more-install-apk-download-button")).toBeVisible();

    await androidPage.getByTestId("more-install-apk-guide-button").click();
    await expect(androidPage.getByTestId("more-install-apk-guide-modal")).toBeVisible();
    await androidPage.getByTestId("more-install-apk-checksum-toggle").click();
    await expect(androidPage.getByTestId("more-install-apk-checksum-details")).toBeVisible();
    await androidPage.getByTestId("more-install-apk-guide-close").click();

    // Em modo standalone (PWA Android), o botão de APK continua disponível em Mais
    await androidPage.addInitScript(() => {
      const originalMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = (query: string) => {
        if (query === "(display-mode: standalone)") {
          return {
            matches: true,
            media: query,
            onchange: null,
            addListener: () => undefined,
            removeListener: () => undefined,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            dispatchEvent: () => false,
          } as MediaQueryList;
        }
        return originalMatchMedia(query);
      };
    });
    await androidPage.goto("/more", { waitUntil: "networkidle" });
    await expect(androidPage.getByTestId("more-install-apk-download-button")).toBeVisible();
    expect(androidErrors.pageErrors).toEqual([]);
    expect(androidErrors.consoleErrors).toEqual([]);
  } finally {
    await androidContext.close();
  }

  // 4. Mobile iPhone (Safari): apenas "Instalar no iPhone", sem botão de APK; oculto em standalone
  const iosContext = await browser.newContext({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    viewport: { width: 390, height: 844 },
  });
  try {
    const iosPage = await iosContext.newPage();
    const iosErrors = collectErrors(iosPage);
    await setupApiMocks(iosPage, {
      onboarding: { version: "v1", status: "completed", shouldAutoStart: false },
      apkRelease: validApkRelease,
    });

    await iosPage.goto("/login", { waitUntil: "networkidle" });
    await expect(iosPage.getByTestId("login-install-install-button")).toBeVisible();
    await expect(iosPage.getByTestId("login-install-apk-download-button")).toHaveCount(0);
    await iosPage.getByTestId("login-install-install-button").click();
    await expect(iosPage.getByTestId("login-install-instructions-modal")).toBeVisible();
    await expect(iosPage.getByTestId("login-install-modal-apk-button")).toHaveCount(0);
    await iosPage.getByTestId("login-install-instructions-close").click();

    await login(iosPage);
    await iosPage.getByRole("tab", { name: "Mais" }).first().click();
    await expect(iosPage.getByTestId("more-install-install-button")).toBeVisible();
    await expect(iosPage.getByTestId("more-install-apk-download-button")).toHaveCount(0);

    await iosPage.addInitScript(() => {
      const originalMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = (query: string) => {
        if (query === "(display-mode: standalone)") {
          return {
            matches: true,
            media: query,
            onchange: null,
            addListener: () => undefined,
            removeListener: () => undefined,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            dispatchEvent: () => false,
          } as MediaQueryList;
        }
        return originalMatchMedia(query);
      };
    });
    await iosPage.goto("/more", { waitUntil: "networkidle" });
    await expect(iosPage.getByTestId("more-install-install-button")).toHaveCount(0);
    expect(iosErrors.pageErrors).toEqual([]);
    expect(iosErrors.consoleErrors).toEqual([]);
  } finally {
    await iosContext.close();
  }
});

test("tutorial de primeiro acesso percorre abas, permite pular com lembrete, rever em Mais e concluir no Perfil", async ({ page }) => {
  const errors = collectErrors(page);
  const onboardingPatches: string[] = [];
  let savedInstrumentIds: string[] = [];

  await page.setViewportSize({ width: 390, height: 844 });
  await setupApiMocks(page, {
    role: "MEMBER",
    instruments: [],
    onOnboardingPatch: (payload) => onboardingPatches.push(payload.status),
    onInstrumentsPatch: (payload) => {
      savedInstrumentIds = payload.instrumentIds;
    },
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await login(page);

  // Inicia automaticamente no Passo 1 (Início)
  await expect(page.getByTestId("onboarding-overlay")).toBeVisible();
  await expect(page.getByTestId("onboarding-spotlight")).toBeVisible();
  await expect(page.getByTestId("onboarding-step-title")).toHaveText("Início");
  await expect(page.getByTestId("onboarding-progress")).toContainText("Passo 1 de 5");

  // Avançar e Voltar
  await page.getByTestId("onboarding-next-button").click();
  await expect(page.getByTestId("onboarding-step-title")).toHaveText("Escalas");
  await page.getByTestId("onboarding-prev-button").click();
  await expect(page.getByTestId("onboarding-step-title")).toHaveText("Início");

  // Pular tutorial exibe lembrete discreto em Início
  await page.getByTestId("onboarding-skip-button").click();
  await expect(page.getByTestId("onboarding-overlay")).toHaveCount(0);
  await expect.poll(() => onboardingPatches).toContain("dismissed");
  await expect(page.getByTestId("home-instruments-reminder")).toBeVisible();

  // Rever tutorial em Mais
  await page.getByRole("tab", { name: "Mais" }).first().click();
  await page.getByTestId("more-review-tutorial").click();
  await expect(page.getByTestId("onboarding-overlay")).toBeVisible();
  await expect(page.getByTestId("onboarding-step-title")).toHaveText("Início");

  // Percorre todas as abas até o passo final
  for (const expectedTitle of ["Escalas", "Músicas", "Mais", "Vincule seu instrumento ou cargo"]) {
    await page.getByTestId("onboarding-next-button").click();
    await expect(page.getByTestId("onboarding-step-title")).toHaveText(expectedTitle);
  }

  // Botão abre Perfil diretamente na seleção de instrumentos/cargos
  await page.getByTestId("onboarding-link-instruments-button").click();
  await expect(page).toHaveURL(/\/profile\?section=instruments/);
  await expect(page.getByText("Selecionar instrumentos/cargos")).toBeVisible();

  // Seleciona instrumento, confirma no servidor e conclui tutorial
  await page.getByTestId("instrument-toggle-instrument-1").click();
  await expect.poll(() => savedInstrumentIds).toEqual(["instrument-1"]);
  await expect.poll(() => onboardingPatches).toContain("completed");

  await page.getByLabel("Fechar seleção de instrumentos").click();
  await page.getByRole("tab", { name: "Início" }).first().click();
  await expect(page.getByTestId("home-instruments-reminder")).toHaveCount(0);

  expect(errors.pageErrors).toEqual([]);
  expect(errors.consoleErrors).toEqual([]);
});

test("catálogo vazio orienta membro e oferece Criar e selecionar para gestão", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setupApiMocks(page, {
    role: "MEMBER",
    catalog: [],
    instruments: [],
    onboarding: { version: "v1", status: "completed", shouldAutoStart: false },
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await login(page);
  await page.goto("/profile?section=instruments", { waitUntil: "networkidle" });
  await expect(page.getByText("Nenhum instrumento disponível")).toBeVisible();
  await expect(page.getByText("Peça a um administrador para cadastrar instrumentos ou cargos.")).toBeVisible();
  await expect(page.getByTestId("profile-instrument-create-button")).toHaveCount(0);

  // Conta de gestão vê opção Criar e selecionar
  await page.evaluate(() => window.localStorage.clear());
  await page.unroute("**/api/**").catch(() => undefined);
  await setupApiMocks(page, {
    role: "TENANT_ADMIN",
    catalog: [],
    instruments: [],
    onboarding: { version: "v1", status: "completed", shouldAutoStart: false },
  });
  await page.goto("/", { waitUntil: "networkidle" });
  await login(page, "ana@example.com");
  await page.goto("/profile?section=instruments", { waitUntil: "networkidle" });
  await expect(page.getByTestId("profile-instrument-create-button")).toBeVisible();
  await page.getByTestId("profile-instrument-name-input").fill("Violoncelo");
  await page.getByTestId("profile-instrument-create-button").click();
  await expect(page.getByText("Violoncelo").first()).toBeVisible();
});
