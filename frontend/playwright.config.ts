import * as dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

import { defineConfig, devices } from "@playwright/test";

process.env.E2E_SEED = process.env.E2E_SEED ?? '';

export default defineConfig({
  testDir: "./e2e",
  reporter: [["html"], ["list"]],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    ...devices["Desktop Chrome"],
    launchOptions: {
      slowMo: 1000,
    },
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    video: { mode: "on", size: { width: 1280, height: 720 } },
    extraHTTPHeaders: {
      "x-e2e-seed": process.env.E2E_SEED ?? '',
    },
  },
  webServer: {
    command: "E2E_SEED=1 npm run dev -- --host localhost --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
