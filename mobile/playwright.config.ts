import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
if (process.env.LAUDA_THEME_PREVIEW_TEST === "1" && externalBaseURL !== "http://127.0.0.1:8094") {
  throw new Error("Visual preview tests require PLAYWRIGHT_BASE_URL=http://127.0.0.1:8094");
}

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: process.env.LAUDA_THEME_PREVIEW_TEST === "1" ? "./tests/e2e/theme-preview.setup.ts" : undefined,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  // Keep a single worker because the suite shares one exported static build and
  // one local server. This also makes hard-reload/hydration checks deterministic.
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: externalBaseURL ?? "http://127.0.0.1:8099",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: externalBaseURL ? undefined : {
    command: "npm run build:web && npm run serve:web -- --listen 8099",
    url: "http://127.0.0.1:8099",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL ?? "https://api.laudaapp.com/api",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
