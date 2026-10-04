import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = process.env.PORT || "3000";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_SKIP_SERVER
    ? undefined
    : [
        {
          command:
            "uv run --directory services/api python -m scenarios.cli seed && uv run --directory services/api uvicorn app.main:app --host 127.0.0.1 --port 8000",
          cwd: repoRoot,
          url: "http://127.0.0.1:8000/healthz",
          timeout: 90_000,
          env: {
            ...process.env,
            DEMO_MODE: "true",
            JWT_SECRET: "test-secret-at-least-32-bytes-long",
            COOKIE_SECURE: "false",
          },
        },
        {
          command: "pnpm --filter @vyuha/web start",
          cwd: repoRoot,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: { ...process.env, PORT: port },
        },
      ],
});
