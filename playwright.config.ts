import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "apps/web/e2e",
  timeout: 180_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    viewport: { width: 1280, height: 720 },
    baseURL: "http://localhost:4173",
  },
  webServer: [
    {
      command: "pnpm --filter @orbitscar/server dev",
      url: "http://127.0.0.1:4179/health",
      env: { ORBITSCAR_PORT: "4179", ORBITSCAR_DATABASE: `./test-results/browser-authority-${process.pid}.json` },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "pnpm build:web && pnpm --filter @orbitscar/web exec vite preview --port 4173 --strictPort",
      port: 4173,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
