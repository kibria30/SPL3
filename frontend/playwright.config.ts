import { defineConfig, devices } from "@playwright/test";

const E2E_DB = process.env.E2E_DB ?? "tsf_e2e";
// Delay (ms) after every browser action so a human can follow along; 0 = full speed.
const SLOW_MO = Number(process.env.E2E_SLOWMO ?? 0);

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  globalSetup: "./e2e/global-setup.ts",
  timeout: SLOW_MO ? 300_000 : 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // backend runs at most 2 experiments at once
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000", // must be `localhost` (cookie + CORS)
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    launchOptions: { slowMo: SLOW_MO },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // Fresh isolated DB every run, then serve. (webServer starts before globalSetup.)
      command:
        `dropdb --if-exists --force ${E2E_DB} && createdb ${E2E_DB} && ` +
        "../env/bin/python -m alembic upgrade head && " +
        "../env/bin/python -m app.seed && " +
        "../env/bin/uvicorn app.main:app --port 8000",
      cwd: "../backend",
      url: "http://localhost:8000/health",
      reuseExistingServer: false,
      timeout: 300_000,
      env: { DATABASE_URL: `postgresql+psycopg2:///${E2E_DB}` },
    },
    {
      command: "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
