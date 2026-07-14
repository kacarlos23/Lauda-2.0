import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  // Expo/Metro performs the initial web bundle on demand. Running browsers in
  // parallel makes that first compilation contend with itself and causes
  // navigation timeouts, especially in CI.
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: externalBaseURL ?? "http://127.0.0.1:8099",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: externalBaseURL ? undefined : {
    command: "npx expo start --web --offline --port 8099",
    url: "http://127.0.0.1:8099",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
