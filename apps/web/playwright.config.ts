import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests for critical flows. Both apps are started here against a
 * dedicated database (`jjpasteis-menu-e2e`) that is recreated and seeded on
 * every run; Postgres and Redis must be reachable with apps/api/.env.
 */
const API_PORT = 3334;
const WEB_PORT = 3100;

export const E2E_ADMIN = {
  email: "e2e-admin@example.com",
  password: "e2e-secret123",
};

export const API_URL = `http://localhost:${API_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command:
        "node ace migration:fresh --force && node ace db:seed && node ace serve",
      cwd: "../api",
      url: `${API_URL}/api/v1/auth/me`,
      // /auth/me answers 401 when the server is up.
      ignoreHTTPSErrors: true,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        PORT: String(API_PORT),
        // Upload URLs (seeded banner/logo) must point at this API.
        APP_URL: API_URL,
        DB_DATABASE: "jjpasteis-menu-e2e",
        LIMITER_STORE: "memory",
        // Every e2e request comes from localhost.
        PUBLIC_ORDER_RATE_LIMIT: "10000",
        DRIVE_DISK: "fs",
        FRONTEND_URL: `http://localhost:${WEB_PORT}`,
        ADMIN_USER: E2E_ADMIN.email,
        ADMIN_PASS: E2E_ADMIN.password,
      },
    },
    {
      command: `pnpm exec next dev --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/app/login`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        NEXT_DIST_DIR: ".next-e2e",
        NEXT_PUBLIC_API_URL: `${API_URL}/api/v1`,
        NEXT_PUBLIC_APP_URL: `http://localhost:${WEB_PORT}`,
      },
    },
  ],
});
